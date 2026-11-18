import { OAuth2Client } from "google-auth-library";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { User } from "../auth/user.model.js";
import crypto from "crypto";
import axios from "axios";
import jwt from "jsonwebtoken";
import { sendEmailVerificationEmail, sendPasswordResetEmail } from "../../services/email.service.js";
import { createCsrfToken } from "../../middleware/csrf.middleware.js";
import {
    hashRefreshToken,
    MIN_PASSWORD_LENGTH,
    refreshTokenMatches,
} from "./auth.security.js";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshTokenHash = hashRefreshToken(refreshToken);
        user.refreshToken = undefined;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
};

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

const csrfCookieOptions = {
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    httpOnly: false,
};

const clearAuthCookies = (res) => res
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions);

export const getCsrfToken = asyncHandler(async (req, res) => {
    const csrfToken = createCsrfToken();

    return res
        .status(200)
        .cookie("csrfToken", csrfToken, csrfCookieOptions)
        .json(new ApiResponse(200, { csrfToken }, "CSRF token issued successfully"));
});

export const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, phone, turnstileToken } = req.body;

    if (!turnstileToken) {
        return res.status(400).json({ message: "Security token is missing." });
    }

    try {
        // The user prompt said 'https://cloudflare.com', but the actual endpoint for Turnstile is this one.
        // Using the standard Turnstile endpoint to ensure it works correctly.
        const turnstileRes = await axios.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: turnstileToken
        });

        if (!turnstileRes.data.success) {
            return res.status(400).json({ message: "Security verification failed. Automated request blocked. Refresh & try again." });
        }
    } catch (error) {
        return res.status(400).json({ message: "Security verification failed. Automated request blocked. Refresh & try again." });
    }

    if (!name?.trim() || !email?.trim() || !password) {
        throw new ApiError(400, "Name, email, and password are required");
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existedUser = await User.findOne({ email: normalizedEmail });
    if (existedUser) {
        throw new ApiError(409, "User with this email already exists");
    }

    const user = new User({
        name,
        email: normalizedEmail,
        password,
        phone,
        isEmailVerified: false,
    });
    const verificationToken = user.createEmailVerificationToken();
    await user.save();

    await sendEmailVerificationEmail(user.email, verificationToken);

    const createdUser = await User.findById(user._id)
        .select("-password -refreshToken -refreshTokenHash -emailVerificationToken -emailVerificationExpiry");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "Account created. Please verify your email before signing in.")
    );
});

export const loginUser = asyncHandler(async (req, res) => {
    const { email, password, turnstileToken } = req.body;

    if (!turnstileToken) {
        return res.status(400).json({ message: "Security token is missing." });
    }

    try {
        const turnstileRes = await axios.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: turnstileToken
        });

        if (!turnstileRes.data.success) {
            return res.status(400).json({ message: "Security verification failed. Refresh & try again." });
        }
    } catch (error) {
        return res.status(400).json({ message: "Security verification failed. Refresh & try again." });
    }

    if (!email?.trim() || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user || !(await user.isPasswordCorrect(password))) {
        throw new ApiError(401, "Invalid email or password");
    }

    // Accounts created before verification was introduced have no flag. Treat
    // those legacy accounts as verified so existing customers are not locked out.
    if (user.isEmailVerified === undefined) {
        user.isEmailVerified = true;
        await user.save({ validateBeforeSave: false });
    }

    if (user.role === "customer" && user.isEmailVerified === false) {
        throw new ApiError(403, "Please verify your email address before signing in");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken -refreshTokenHash");

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser },
                "User logged in successfully"
            )
        );
});

export const logoutUser = asyncHandler(async (req, res) => {
    let userId = req.user?._id;
    const refreshToken = req.cookies?.refreshToken;

    // Logout must still revoke the session when the short-lived access token
    // has already expired.
    if (!userId && refreshToken) {
        try {
            const decodedToken = jwt.verify(
                refreshToken,
                process.env.REFRESH_TOKEN_SECRET
            );
            userId = decodedToken?._id;
        } catch {
            // The cookies are cleared below even when the refresh token is
            // missing or already invalid.
        }
    }

    if (userId) {
        await User.findByIdAndUpdate(
            userId,
            {
                $unset: { refreshToken: 1, refreshTokenHash: 1 },
                $inc: { tokenVersion: 1 },
            },
            { new: true }
        );
    }

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
        return clearAuthCookies(res)
            .status(401)
            .json(new ApiResponse(401, null, "Invalid or expired refresh token"));
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );
    } catch {
        return clearAuthCookies(res)
            .status(401)
            .json(new ApiResponse(401, null, "Invalid or expired refresh token"));
    }

    const user = await User.findById(decodedToken?._id);
    if (!user || !refreshTokenMatches(refreshToken, user)) {
        return clearAuthCookies(res)
            .status(401)
            .json(new ApiResponse(401, null, "Invalid or expired refresh token"));
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken -refreshTokenHash");

    return res
        .status(200)
        .cookie("accessToken", newAccessToken, cookieOptions)
        .cookie("refreshToken", newRefreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser },
                "Session refreshed successfully"
            )
        );
});

export const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

// Part 2
export const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!newPassword) {
        throw new ApiError(400, "New password is required");
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new ApiError(400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // If user already has a password set, verify old password
    if (user.password) {
        if (!oldPassword) {
            throw new ApiError(400, "Current password is required");
        }
        const isPasswordValid = await user.isPasswordCorrect(oldPassword);
        if (!isPasswordValid) {
            throw new ApiError(400, "Invalid old password");
        }
    }

    user.password = newPassword;
    user.refreshToken = undefined;
    user.refreshTokenHash = undefined;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save({ validateBeforeSave: false }); // Pre-save hook will hash it

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password updated successfully"));
});

export const updateAccountDetails = asyncHandler(async (req, res) => {
    const { name, phone } = req.body;

    if (!name) {
        throw new ApiError(400, "Name is required");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                name,
                phone, // Optional
            },
        },
        { new: true, runValidators: true }
    ).select("-password -refreshToken -refreshTokenHash");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"));
});

export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });

    // We do not throw an error if user is not found to prevent email enumeration attacks
    if (!user) {
        return res
            .status(200)
            .json(new ApiResponse(200, null, "If an account exists, a password reset email has been sent."));
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // PHASE 12: Send Password Reset Email
    await sendPasswordResetEmail(user.email, resetToken);

    return res.status(200).json(
        new ApiResponse(200, null, "If an account exists, a password reset email has been sent.")
    );
});

export const verifyEmail = asyncHandler(async (req, res) => {
    const hashedToken = crypto
        .createHash("sha256")
        .update(req.params.token)
        .digest("hex");

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpiry: { $gt: Date.now() },
    });

    if (!user) {
        throw new ApiError(400, "Email verification link is invalid or has expired");
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, null, "Email verified successfully"));
});

export const resendVerificationEmail = asyncHandler(async (req, res) => {
    const normalizedEmail = String(req.body.email || "").trim().toLowerCase();

    if (!normalizedEmail) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email: normalizedEmail, role: "customer" });
    if (user && user.isEmailVerified === false) {
        const verificationToken = user.createEmailVerificationToken();
        await user.save({ validateBeforeSave: false });
        await sendEmailVerificationEmail(user.email, verificationToken);
    }

    return res.status(200).json(new ApiResponse(200, null, "If the account requires verification, a new email has been sent."));
});

export const resetPassword = asyncHandler(async (req, res) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
        throw new ApiError(400, "New password is required");
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new ApiError(400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }

    // Hash the token from params to compare with the one in DB
    const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    const user = await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
        throw new ApiError(400, "Token is invalid or has expired");
    }

    user.password = newPassword;
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;
    user.refreshToken = undefined;
    user.refreshTokenHash = undefined;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;

    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password reset successfully"));
});


const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
        throw new ApiError(400, "Google token is required");
    }

    try {
        // 1. Verify the token securely with Google
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        // 2. Extract the user's details from the verified token
        const { email, name, picture, sub: googleId } = ticket.getPayload();

        // 3. Check if the user already exists in your database
        let user = await User.findOne({ email });

        if (!user) {
            // 4. If they don't exist, create a new account automatically
            user = await User.create({
                name,
                email,
                googleId,
                avatar: picture,
                // If you have email verification in your app, auto-verify them!
                isEmailVerified: true 
            });
        } else if (!user.googleId) {
            // If they signed up manually before, link their Google account now
            user.googleId = googleId;
            if (!user.avatar) user.avatar = picture;
            user.isEmailVerified = true;
            await user.save();
        } else if (user.isEmailVerified === false) {
            // Google has already verified ownership of this email address.
            user.isEmailVerified = true;
            await user.save({ validateBeforeSave: false });
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

        // Remove sensitive info before sending response
        const loggedInUser = await User.findById(user._id)
            .select("-password -refreshToken -refreshTokenHash");

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json(
                new ApiResponse(
                    200,
                    { user: loggedInUser },
                    "Google Login Successful"
                )
            );

    } catch (error) {
        console.error("Google Auth Error:", error);
        throw new ApiError(401, "Invalid Google token");
    }
});
