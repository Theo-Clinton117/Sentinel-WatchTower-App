"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { sendOtp } = require("../src/common/kudisms");

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

test("sendOtp posts the KudiSMS OTP template fields as multipart form data", async () => {
    const originalFetch = global.fetch;
    let request;
    global.fetch = async (url, options) => {
        request = { url, options };
        return { ok: true };
    };

    try {
        await withEnv(
            {
                KUDISMS_OTP_URL: "https://sms.example.test/otp",
                KUDISMS_TOKEN: "token",
                KUDISMS_SENDER_ID: "Sentinel",
                KUDISMS_APP_NAME_CODE: "sentinel-app",
                KUDISMS_TEMPLATE_CODE: "sentinel-otp",
            },
            () => sendOtp("2348012345678", "123456"),
        );

        assert.equal(request.url, "https://sms.example.test/otp");
        assert.equal(request.options.method, "POST");
        assert.deepEqual(Object.fromEntries(request.options.body.entries()), {
            token: "token",
            senderID: "Sentinel",
            recipients: "2348012345678",
            otp: "123456",
            appnamecode: "sentinel-app",
            templatecode: "sentinel-otp",
        });
    }
    finally {
        global.fetch = originalFetch;
    }
});

test("sendOtp sanitizes KudiSMS provider errors", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
        ok: false,
        status: 401,
        text: async () => 'token=should-not-be-exposed',
    });

    try {
        await withEnv(
            {
                KUDISMS_TOKEN: "token",
                KUDISMS_SENDER_ID: "Sentinel",
                KUDISMS_APP_NAME_CODE: "sentinel-app",
                KUDISMS_TEMPLATE_CODE: "sentinel-otp",
            },
            async () => {
                await assert.rejects(
                    () => sendOtp("+2348012345678", "123456"),
                    (error) => error?.message === "Could not publish OTP with KudiSMS (HTTP 401)." && !error.message.includes("should-not-be-exposed"),
                );
            },
        );
    }
    finally {
        global.fetch = originalFetch;
    }
});
