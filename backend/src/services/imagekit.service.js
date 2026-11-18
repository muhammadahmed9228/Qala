import { imagekit } from "../config/imagekit.js";

// ImageKit deletion is intentionally idempotent. A file that was already
// removed is treated as successfully cleaned up, which makes admin retries safe.
export const deleteImageKitFile = async (fileId) => {
    if (!fileId) return;

    try {
        await imagekit.deleteFile(fileId);
    } catch (error) {
        const statusCode = error?.statusCode || error?.status;
        const message = String(error?.message || "");
        if (statusCode === 404 || /not found|does not exist/i.test(message)) {
            return;
        }
        throw error;
    }
};
