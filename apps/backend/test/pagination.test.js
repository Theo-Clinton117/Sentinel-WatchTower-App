"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { getPagination } = require("../src/common/pagination");

test("getPagination returns safe defaults", () => {
    assert.deepEqual(getPagination(), { limit: 100, offset: 0 });
});

test("getPagination clamps limit and offset", () => {
    assert.deepEqual(getPagination({ limit: 500, offset: -10 }), { limit: 100, offset: 0 });
    assert.deepEqual(getPagination({ limit: 0, offset: 12 }), { limit: 100, offset: 12 });
    assert.deepEqual(getPagination({ limit: 20, offset: 5 }), { limit: 20, offset: 5 });
});

test("getPagination supports custom defaults", () => {
    assert.deepEqual(getPagination({}, { limit: 30, maxLimit: 50 }), { limit: 30, offset: 0 });
    assert.deepEqual(getPagination({ limit: 80 }, { limit: 30, maxLimit: 50 }), { limit: 50, offset: 0 });
});
