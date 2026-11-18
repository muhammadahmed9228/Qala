import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    changeCurrentPassword,
    updateAccountDetails,
    forgotPassword,
    resetPassword,
    googleLogin,
    refreshAccessToken,
    getCsrfToken,
    verifyEmail,
    resendVerificationEmail
} from "./auth.controller.js";
import { verifyJWT } from "../../middleware/auth.middleware.js";
import {
    authLimiter,
    googleAuthLimiter,
    refreshLimiter,
    verificationLimiter,
} from "../../middleware/rateLimiter.middleware.js";

const router = Router();

// Public routes with STRICT rate limiting
router.route("/register").post(authLimiter, registerUser);
router.route("/login").post(authLimiter, loginUser);
router.route("/forgot-password").post(authLimiter, forgotPassword);
router.route("/reset-password/:resetToken").post(authLimiter, resetPassword);
router.route("/refresh").post(refreshLimiter, refreshAccessToken);
router.route("/csrf-token").get(getCsrfToken);
router.route("/verify-email/:token").get(verificationLimiter, verifyEmail);
router.route("/resend-verification").post(verificationLimiter, resendVerificationEmail);
// Google Auth Route
router.post("/google", googleAuthLimiter, googleLogin);

// Secured routes
router.route("/logout").post(logoutUser);
router.route("/me").get(verifyJWT, getCurrentUser);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/update-profile").patch(verifyJWT, updateAccountDetails);

export default router;
