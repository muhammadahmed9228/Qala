import assert from "node:assert/strict";
import test from "node:test";
import { pickAllowedFields } from "../src/utils/pickAllowedFields.js";

test("pickAllowedFields keeps editable fields and drops protected fields", () => {
    const result = pickAllowedFields(
        {
            name: "Updated product",
            published: true,
            isDeleted: true,
            soldCount: 999,
            userRef: "attacker-controlled"
        },
        ["name", "published"]
    );

    assert.deepEqual(result, { name: "Updated product", published: true });
    assert.equal(Object.hasOwn(result, "isDeleted"), false);
    assert.equal(Object.hasOwn(result, "soldCount"), false);
    assert.equal(Object.hasOwn(result, "userRef"), false);
});
