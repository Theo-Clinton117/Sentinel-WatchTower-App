"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ReportsService } = require("../src/reports/reports.service");

test("report create rejects whitespace-only titles before touching the database", async () => {
    const service = new ReportsService({
        async transaction() {
            throw new Error("database should not be touched");
        },
    });

    await assert.rejects(() => service.create("user-1", { title: "   " }), /title is required/);
});

test("report create rejects invalid media URLs before touching the database", async () => {
    const service = new ReportsService({
        async transaction() {
            throw new Error("database should not be touched");
        },
    });

    await assert.rejects(() => service.create("user-1", {
        title: "Suspicious activity",
        media: [{ url: "file:///secret.txt" }],
    }), /http or https/);
});

test("report create limits media payload size before touching the database", async () => {
    const service = new ReportsService({
        async transaction() {
            throw new Error("database should not be touched");
        },
    });

    await assert.rejects(() => service.create("user-1", {
        title: "Suspicious activity",
        media: Array.from({ length: 7 }, (_, index) => ({ url: `https://example.com/${index}.jpg` })),
    }), /maximum of 6/);
});
