import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../src/modules/auth/user.model.js";

test("email verification tokens are hashed and expire in the future", () => {
    const user = new User({
        name: "Test Customer",
        email: "test@example.com",
        password: "password123"
    });

    const token = user.createEmailVerificationToken();

    assert.equal(token.length, 64);
    assert.notEqual(user.emailVerificationToken, token);
    assert.ok(user.emailVerificationExpiry > Date.now());
});
