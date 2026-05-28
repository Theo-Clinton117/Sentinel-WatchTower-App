"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { HealthService } = require("../src/health/health.service");

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
    return Promise.resolve()
        .then(work)
        .finally(() => {
            for (const key of Object.keys(patch)) {
                if (previous[key] === undefined) {
                    delete process.env[key];
                }
                else {
                    process.env[key] = previous[key];
                }
            }
        });
}

test("health reports optional provider configuration using the env names services consume", async () => {
    await withEnv(
        {
            REDIS_URL: "",
            TWILIO_ACCOUNT_SID: "sid",
            TWILIO_AUTH_TOKEN: "token",
            TWILIO_FROM_NUMBER: "+15551234567",
            TWILIO_VERIFY_SERVICE_SID: "verify",
            RESEND_API_KEY: "resend",
            OTP_EMAIL_FROM: "security@example.com",
            REVENUECAT_PROJECT_ID: "project",
            REVENUECAT_SECRET_API_KEY: "secret",
            REVENUECAT_SECRET_KEY: undefined,
        },
        async () => {
            const service = new HealthService({
                async query() {
                    return { rows: [{ ok: 1 }] };
                },
            }, async () => ({ ok: false, configured: false }));

            const health = await service.getHealth();

            assert.equal(health.status, "ok");
            assert.equal(health.checks.sms.configured, true);
            assert.equal(health.checks.phoneVerification.configured, true);
            assert.equal(health.checks.email.configured, true);
            assert.equal(health.checks.revenueCat.configured, true);
        },
    );
});

test("health degrades when configured Redis is unreachable", async () => {
    await withEnv(
        {
            REDIS_URL: "redis://localhost:6379",
        },
        async () => {
            const service = new HealthService({
                async query() {
                    return { rows: [{ ok: 1 }] };
                },
            }, async () => ({ ok: false, configured: true, error: "connection refused" }));

            const health = await service.getHealth();

            assert.equal(health.status, "degraded");
            assert.equal(health.checks.redis.configured, true);
            assert.equal(health.checks.redis.ok, false);
        },
    );
});
