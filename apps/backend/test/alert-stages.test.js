"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
    ALERT_STAGE_ORDER,
    compareAlertStages,
    getAlertStageLabel,
    getCancelWindowMs,
    getEscalationLevel,
    getNextEscalationPlan,
    normalizeAlertStage,
} = require("../src/alerts/alert-stages");

test("alert stages keep the expected escalation order", () => {
    assert.deepEqual(ALERT_STAGE_ORDER, [
        "monitoring",
        "suspicious",
        "soft_alert",
        "high_alert",
        "critical",
    ]);
    assert.equal(compareAlertStages("monitoring", "critical") < 0, true);
    assert.equal(compareAlertStages("critical", "soft_alert") > 0, true);
    assert.equal(compareAlertStages("high_alert", "high_alert"), 0);
});

test("normalizeAlertStage falls back to high_alert for unsafe values", () => {
    assert.equal(normalizeAlertStage(" SOFT_ALERT "), "soft_alert");
    assert.equal(normalizeAlertStage("unknown"), "high_alert");
    assert.equal(normalizeAlertStage(null), "high_alert");
});

test("alert stage helpers expose stable launch-critical timing", () => {
    assert.equal(getEscalationLevel("monitoring"), 0);
    assert.equal(getEscalationLevel("critical"), 4);
    assert.equal(getAlertStageLabel("soft_alert"), "Soft Alert");
    assert.deepEqual(getNextEscalationPlan("soft_alert"), {
        targetStage: "high_alert",
        delayMs: 10 * 1000,
    });
    assert.deepEqual(getNextEscalationPlan("high_alert"), {
        targetStage: "critical",
        delayMs: 3 * 60 * 1000,
    });
    assert.equal(getNextEscalationPlan("critical"), null);
    assert.equal(getCancelWindowMs("soft_alert"), 10 * 1000);
    assert.equal(getCancelWindowMs("high_alert"), 0);
});
