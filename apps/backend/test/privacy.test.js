"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    sanitizeAuditMetadata,
    sanitizeNotificationPayload,
} = require("../src/common/privacy");

test("sanitizeAuditMetadata removes direct contact and location fields", () => {
    const result = sanitizeAuditMetadata({
        reason: "manual_review",
        note: "call +15550001234",
        location: { lat: 6.5, lng: 3.3 },
        contacts: 3,
        nested: {
            email: "secret@example.com",
            allowed: true,
        },
    });

    assert.deepEqual(result, {
        reason: "manual_review",
        contacts: 3,
        nested: {
            allowed: true,
        },
    });
});

test("sanitizeNotificationPayload preserves display text while dropping contact details", () => {
    const result = sanitizeNotificationPayload({
        audience: "trusted_contact",
        message: "Sentinel alert started",
        subject: "Alert",
        recipientName: "Tola",
        recipientEmail: "tola@example.com",
        recipientPhone: "+15550000003",
        location: { lat: 6.5, lng: 3.3 },
        ignored: "value",
    });

    assert.deepEqual(result, {
        audience: "trusted_contact",
        message: "Sentinel alert started",
        subject: "Alert",
        recipientName: "Tola",
    });
});
