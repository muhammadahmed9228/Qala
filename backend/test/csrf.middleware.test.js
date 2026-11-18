import assert from "node:assert/strict";
import test from "node:test";
import { createCsrfToken, verifyCsrfToken } from "../src/middleware/csrf.middleware.js";

const requestWithToken = (method, cookieToken, headerToken) => ({
    method,
    cookies: cookieToken ? { csrfToken: cookieToken } : {},
    get: () => headerToken,
});

test("CSRF middleware allows safe requests", () => {
    let nextCalled = false;

    verifyCsrfToken(
        requestWithToken("GET"),
        {},
        () => { nextCalled = true; }
    );

    assert.equal(nextCalled, true);
});

test("CSRF middleware requires matching cookie and header tokens", () => {
    const token = createCsrfToken();
    let nextCalled = false;

    verifyCsrfToken(
        requestWithToken("POST", token, token),
        {},
        () => { nextCalled = true; }
    );

    assert.equal(nextCalled, true);
    assert.throws(
        () => verifyCsrfToken(requestWithToken("POST", token, "wrong-token"), {}, () => {}),
        (error) => error.statusCode === 403
    );
});
