"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { encryptField, decryptField } = require("../src/common/field-encryption");

test("field encryption round-trips and uses a fresh envelope each time", () => {
    const previous = process.env.FIELD_ENCRYPTION_KEY;
    process.env.FIELD_ENCRYPTION_KEY = "test-field-encryption-key-1234567890";
    try {
        const first = encryptField("+2348012345678");
        const second = encryptField("+2348012345678");
        assert.notEqual(first, second);
        assert.match(first, /^enc:v1:/);
        assert.equal(decryptField(first), "+2348012345678");
        assert.equal(decryptField("legacy-value"), "legacy-value");
    } finally {
        if (previous === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
        else process.env.FIELD_ENCRYPTION_KEY = previous;
    }
});

test("production refuses to encrypt protected fields without a dedicated key", () => {
    const previousEnv = process.env.NODE_ENV;
    const previousKey = process.env.FIELD_ENCRYPTION_KEY;
    process.env.NODE_ENV = "production";
    delete process.env.FIELD_ENCRYPTION_KEY;
    try {
        assert.throws(() => encryptField("private value"), /FIELD_ENCRYPTION_KEY/);
    } finally {
        if (previousEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnv;
        if (previousKey === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
        else process.env.FIELD_ENCRYPTION_KEY = previousKey;
    }
});
