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
            KUDISMS_TOKEN: "token",
            KUDISMS_SENDER_ID: "Sentinel",
            KUDISMS_APP_NAME_CODE: "Sentinel-Watchtower",
            KUDISMS_TEMPLATE_CODE: "Your @@Sentinel_Watchtower@@ OTP is @@code@@. It expires in 10mins",
            RESEND_API_KEY: "resend",
            OTP_EMAIL_FROM: "security@example.com",
            PAYSTACK_SECRET_KEY: "secret",
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
            assert.equal(health.checks.paystack.configured, true);
        },
    );
});

test("health marks phone verification unhealthy when KudiSMS OTP template fields are missing", async () => {
    await withEnv(
        {
            REDIS_URL: "",
            KUDISMS_TOKEN: "token",
            KUDISMS_SENDER_ID: "Sentinel",
            KUDISMS_APP_NAME_CODE: undefined,
            KUDISMS_TEMPLATE_CODE: undefined,
            RESEND_API_KEY: "resend",
            OTP_EMAIL_FROM: "security@example.com",
            PAYSTACK_SECRET_KEY: "secret",
        },
        async () => {
            const service = new HealthService({
                async query() {
                    return { rows: [{ ok: 1 }] };
                },
            }, async () => ({ ok: false, configured: false }));

            const health = await service.getHealth();

            assert.equal(health.checks.sms.configured, true);
            assert.equal(health.checks.phoneVerification.configured, false);
            assert.equal(health.checks.phoneVerification.ok, false);
        },
    );
});

test("health recognizes Supabase email OTP configuration", async () => {
    await withEnv(
        {
            REDIS_URL: "",
            SUPABASE_URL: "https://example.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY: "service-role",
            RESEND_API_KEY: undefined,
            OTP_EMAIL_FROM: undefined,
        },
        async () => {
            const service = new HealthService({
                async query() {
                    return { rows: [{ ok: 1 }] };
                },
            }, async () => ({ ok: false, configured: false }));

            const health = await service.getHealth();

            assert.equal(health.checks.email.configured, true);
            assert.equal(health.checks.email.provider, "supabase");
        },
    );
});

test("health recognizes the Supabase secret key used by the OTP integration", async () => {
    await withEnv(
        {
            REDIS_URL: "",
            SUPABASE_URL: "https://example.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY: undefined,
            SUPABASE_SECRET_KEY: "sb_secret_test",
            RESEND_API_KEY: undefined,
            OTP_EMAIL_FROM: undefined,
        },
        async () => {
            const service = new HealthService({
                async query() {
                    return { rows: [{ ok: 1 }] };
                },
            }, async () => ({ ok: false, configured: false }));

            const health = await service.getHealth();

            assert.equal(health.checks.email.configured, true);
            assert.equal(health.checks.email.provider, "supabase");
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
