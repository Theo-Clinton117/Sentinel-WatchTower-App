"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { SubscriptionsService } = require("../src/subscriptions/subscriptions.service");
const { getSubscriptionCatalog, normalizePlanId } = require("../src/subscriptions/subscription-catalog");

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

test("list degrades expired cached paid snapshots to free entitlement", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const service = new SubscriptionsService({
        async query() {
            return {
                rows: [{
                    provider: "app_store",
                    status: "active",
                    plan_name: "pro",
                    amount_ngn: 10000,
                    started_at: "2026-01-01T00:00:00.000Z",
                    current_period_end: yesterday,
                    provider_ref: "sub-1",
                }],
            };
        },
    });

    const response = await service.list("user-1");

    assert.equal(response.activePlanId, "free");
    assert.equal(response.status, "expired");
    assert.equal(response.currentPeriodEnd, null);
    assert.equal(response.syncStatus, "cached");
});

test("sync with reference falls back to stored snapshot when Paystack is not configured", async () => {
    await withEnv(
        {
            PAYSTACK_SECRET_KEY: undefined,
        },
        async () => {
            const service = new SubscriptionsService({
                async query() {
                    return { rows: [] };
                },
            });

            const response = await service.syncPayment("user-1", { reference: "ref-1" });

            assert.equal(response.activePlanId, "free");
            assert.equal(response.syncStatus, "paystack_not_configured");
            assert.equal(response.paystack.configured, false);
        },
    );
});

test("resolvePlanFromAmount chooses matching paid plan", () => {
    const service = new SubscriptionsService({ async query() { return { rows: [] }; } });
    const catalog = [
        { id: "free", amountNgn: 0, entitlementKey: null },
        { id: "basic", amountNgn: 1000, entitlementKey: "basic" },
        { id: "family", amountNgn: 3500, entitlementKey: "family" },
        { id: "pro", amountNgn: 10000, entitlementKey: "pro" },
    ];

    const plan = service.resolvePlanFromAmount(catalog, 350000);

    assert.equal(plan.id, "family");
});

test("subscription catalog exposes current paid tier pricing and aliases", () => {
    const catalog = getSubscriptionCatalog();
    const individual = catalog.find((plan) => plan.id === "basic");
    const family = catalog.find((plan) => plan.id === "family");
    const organization = catalog.find((plan) => plan.id === "pro");

    assert.equal(catalog[0].name, "Free");
    assert.equal(individual.name, "Individual");
    assert.equal(individual.amountNgn, 1000);
    assert.equal(family.name, "Family");
    assert.equal(family.amountNgn, 3500);
    assert.equal(organization.name, "Organization");
    assert.equal(organization.amountNgn, 10000);
    assert.equal(normalizePlanId("individual"), "basic");
    assert.equal(normalizePlanId("family"), "family");
    assert.equal(normalizePlanId("organization"), "pro");
    assert.equal(normalizePlanId("enterprise"), "pro");
    assert.equal(normalizePlanId("entriprise"), "pro");
});
