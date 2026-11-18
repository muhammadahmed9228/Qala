import crypto from "crypto";
import { ApiError } from "../utils/ApiError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const secureTokenMatch = (left, right) => {
    if (!left || !right) return false;

    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return leftBuffer.length === rightBuffer.length &&
        crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const createCsrfToken = () => crypto.randomBytes(32).toString("hex");

export const verifyCsrfToken = (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    const cookieToken = req.cookies?.csrfToken;
    const headerToken = req.get("x-csrf-token");

    if (!secureTokenMatch(cookieToken, headerToken)) {
        throw new ApiError(403, "Invalid CSRF token");
    }

    return next();
};
