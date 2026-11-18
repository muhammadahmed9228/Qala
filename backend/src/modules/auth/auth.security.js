import crypto from "crypto";

export const MIN_PASSWORD_LENGTH = 8;

export const hashRefreshToken = (token) =>
    crypto.createHash("sha256").update(token).digest("hex");

export const secureTokenMatch = (left, right) => {
    if (!left || !right) return false;

    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return leftBuffer.length === rightBuffer.length &&
        crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const refreshTokenMatches = (token, user) => {
    const tokenHash = hashRefreshToken(token);

    // Accept the old plaintext value once so existing logged-in users are not
    // forced to log in again. New sessions always use refreshTokenHash.
    return secureTokenMatch(tokenHash, user.refreshTokenHash) ||
        secureTokenMatch(token, user.refreshToken);
};
