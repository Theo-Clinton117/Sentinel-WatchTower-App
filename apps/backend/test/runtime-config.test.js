"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
    getCorsOrigins,
    getJwtAccessSecret,
    getJwtRefreshSecret,
    validateRuntimeConfig,
} = require("../src/config/runtime");

function withEnv(patch, work) {
    const previous = {};
    for (const key of Object.keys(patch)) {
        previous[key] = process.env[key];
        if (patch[key] === undefined) {
            delete process.env[key];
        }
        else {
            process.env[key] = patch[key];
        }
    }
    try {
        work();
    }
    finally {
        for (const key of Object.keys(patch)) {
            if (previous[key] === undefined) {
                delete process.env[key];
            }
            else {
                process.env[key] = previous[key];
            }
        }
    }
}

test("JWT secrets keep dev fallbacks outside production", () => {
    withEnv(
        {
            NODE_ENV: "development",
            JWT_ACCESS_SECRET: undefined,
            JWT_REFRESH_SECRET: undefined,
        },
        () => {
            assert.equal(getJwtAccessSecret(), "change-me");
            assert.equal(getJwtRefreshSecret(), "change-me");
        },
    );
});

test("JWT secrets must be strong in production", () => {
    withEnv(
        {
            NODE_ENV: "production",
            JWT_ACCESS_SECRET: "change-me",
            JWT_REFRESH_SECRET: "short",
        },
        () => {
            assert.throws(() => getJwtAccessSecret(), /JWT_ACCESS_SECRET/);
            assert.throws(() => getJwtRefreshSecret(), /JWT_REFRESH_SECRET/);
        },
    );
});

test("JWT secrets use configured production values", () => {
    withEnv(
        {
            NODE_ENV: "production",
            JWT_ACCESS_SECRET: "a".repeat(32),
            JWT_REFRESH_SECRET: "b".repeat(32),
        },
        () => {
            assert.equal(getJwtAccessSecret(), "a".repeat(32));
            assert.equal(getJwtRefreshSecret(), "b".repeat(32));
        },
    );
});

test("CORS origins stay permissive in development and required in production", () => {
    withEnv(
        {
            NODE_ENV: "development",
            CORS_ORIGINS: undefined,
        },
        () => {
            assert.equal(getCorsOrigins(), true);
        },
    );

    withEnv(
        {
            NODE_ENV: "production",
            CORS_ORIGINS: undefined,
        },
        () => {
            assert.throws(() => getCorsOrigins(), /CORS_ORIGINS/);
        },
    );

    withEnv(
        {
            NODE_ENV: "production",
            CORS_ORIGINS: "https://app.example.com, https://admin.example.com ",
        },
        () => {
            assert.deepEqual(getCorsOrigins(), [
                "https://app.example.com",
                "https://admin.example.com",
            ]);
        },
    );
});

test("production runtime validation requires database config and disables OTP bypass", () => {
    withEnv(
        {
            NODE_ENV: "production",
            JWT_ACCESS_SECRET: "a".repeat(32),
            JWT_REFRESH_SECRET: "b".repeat(32),
            CORS_ORIGINS: "https://app.example.com",
            DATABASE_URL: undefined,
            SUPABASE_DB_URL: undefined,
            OTP_BYPASS_CODE: undefined,
        },
        () => {
            assert.throws(() => validateRuntimeConfig(), /DATABASE_URL|SUPABASE_DB_URL/);
        },
    );

    withEnv(
        {
            NODE_ENV: "production",
            JWT_ACCESS_SECRET: "a".repeat(32),
            JWT_REFRESH_SECRET: "b".repeat(32),
            CORS_ORIGINS: "https://app.example.com",
            DATABASE_URL: "postgres://postgres:postgres@localhost:5432/sentinel",
            SUPABASE_DB_URL: undefined,
            OTP_BYPASS_CODE: "123456",
        },
        () => {
            assert.throws(() => validateRuntimeConfig(), /OTP_BYPASS_CODE/);
        },
    );
});

test("production runtime validation passes with required launch config", () => {
    withEnv(
        {
            NODE_ENV: "production",
            JWT_ACCESS_SECRET: "a".repeat(32),
            JWT_REFRESH_SECRET: "b".repeat(32),
            CORS_ORIGINS: "https://app.example.com",
            DATABASE_URL: "postgres://postgres:postgres@localhost:5432/sentinel",
            SUPABASE_DB_URL: undefined,
            OTP_BYPASS_CODE: undefined,
        },
        () => {
            assert.equal(validateRuntimeConfig(), true);
        },
    );
});
