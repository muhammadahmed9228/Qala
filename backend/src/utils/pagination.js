import { ApiError } from "./ApiError.js";

const DEFAULT_MAX_PAGE = 10000;
const DEFAULT_MAX_LIMIT = 100;

const parsePositiveInteger = (value, field) => {
    const stringValue = String(value);
    if (!/^\d+$/.test(stringValue)) {
        throw new ApiError(400, `${field} must be a positive integer`);
    }

    const parsed = Number(stringValue);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new ApiError(400, `${field} must be a positive integer`);
    }

    return parsed;
};

export const getPagination = (query = {}, { defaultLimit = 20, maxLimit = DEFAULT_MAX_LIMIT, maxPage = DEFAULT_MAX_PAGE } = {}) => {
    const requestedPage = query.page === undefined ? 1 : parsePositiveInteger(query.page, "page");
    const requestedLimit = query.limit === undefined ? defaultLimit : parsePositiveInteger(query.limit, "limit");

    if (!Number.isInteger(defaultLimit) || defaultLimit < 1 || defaultLimit > maxLimit) {
        throw new Error("Invalid pagination defaults");
    }

    return {
        page: Math.min(requestedPage, maxPage),
        limit: Math.min(requestedLimit, maxLimit),
        skip: (Math.min(requestedPage, maxPage) - 1) * Math.min(requestedLimit, maxLimit)
    };
};
