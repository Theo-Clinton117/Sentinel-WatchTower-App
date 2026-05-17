"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { mapReviewerRequestRow } = require("../src/roles/roles.logic");

test("mapReviewerRequestRow returns null for missing rows", () => {
    assert.equal(mapReviewerRequestRow(null), null);
});

test("mapReviewerRequestRow normalizes optional fields for API consumers", () => {
    assert.deepEqual(
        mapReviewerRequestRow({
            id: "request-1",
            user_id: "user-1",
            status: "pending",
            motivation: "",
            admin_note: "",
            requested_at: null,
            reviewed_at: null,
            reviewed_by: null,
            created_at: "2026-05-17T10:00:00.000Z",
            updated_at: "2026-05-17T10:05:00.000Z",
            phone_e164: "+2348012345678",
            name: "Ada",
        }),
        {
            id: "request-1",
            userId: "user-1",
            status: "pending",
            motivation: null,
            adminNote: null,
            requestedAt: "2026-05-17T10:00:00.000Z",
            reviewedAt: null,
            reviewedBy: null,
            createdAt: "2026-05-17T10:00:00.000Z",
            updatedAt: "2026-05-17T10:05:00.000Z",
            user: {
                id: "user-1",
                phone: "+2348012345678",
                name: "Ada",
            },
        },
    );
});
