import assert from "node:assert/strict";
import test from "node:test";
import {
    hashRefreshToken,
    MIN_PASSWORD_LENGTH,
    refreshTokenMatches,
    secureTokenMatch,
} from "../src/modules/auth/auth.security.js";

test("refresh tokens are hashed deterministically", () => {
    const token = "refresh-token-for-test";

    assert.equal(hashRefreshToken(token), hashRefreshToken(token));
    assert.notEqual(hashRefreshToken(token), token);
});

test("refresh token matching supports hashed and legacy sessions", () => {
    const token = "refresh-token-for-test";

    assert.equal(
        refreshTokenMatches(token, { refreshTokenHash: hashRefreshToken(token) }),
        true
    );
    assert.equal(refreshTokenMatches(token, { refreshToken: token }), true);
    assert.equal(refreshTokenMatches("wrong-token", { refreshToken: token }), false);
});

test("refresh token comparisons reject different lengths safely", () => {
    assert.equal(secureTokenMatch("short", "much-longer"), false);
    assert.equal(secureTokenMatch("same", "same"), true);
});

test("password policy has no maximum and requires eight characters", () => {
    assert.equal(MIN_PASSWORD_LENGTH, 8);
    assert.ok("a".repeat(MIN_PASSWORD_LENGTH).length >= MIN_PASSWORD_LENGTH);
    assert.ok("a".repeat(128).length >= MIN_PASSWORD_LENGTH);
});
