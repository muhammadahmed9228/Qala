import assert from "node:assert/strict";
import test from "node:test";
import { getPagination } from "../src/utils/pagination.js";

test("pagination applies safe defaults and caps oversized limits", () => {
    assert.deepEqual(getPagination({}), { page: 1, limit: 20, skip: 0 });
    assert.deepEqual(getPagination({ page: "3", limit: "1000" }), {
        page: 3,
        limit: 100,
        skip: 200
    });
});

test("pagination caps very large pages to protect database skips", () => {
    assert.deepEqual(getPagination({ page: "999999", limit: "10" }), {
        page: 10000,
        limit: 10,
        skip: 99990
    });
});

test("pagination rejects non-positive and malformed values", () => {
    assert.throws(() => getPagination({ page: "0" }), /page must be a positive integer/);
    assert.throws(() => getPagination({ limit: "ten" }), /limit must be a positive integer/);
    assert.throws(() => getPagination({ page: "1.5" }), /page must be a positive integer/);
});
