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
    ]);
    assert.equal(compareAlertStages("monitoring", "high_alert") < 0, true);
    assert.equal(compareAlertStages("critical", "soft_alert") > 0, true);
    assert.equal(compareAlertStages("high_alert", "high_alert"), 0);
});

test("normalizeAlertStage falls back to high_alert for unsafe values", () => {
    assert.equal(normalizeAlertStage(" SOFT_ALERT "), "soft_alert");
    assert.equal(normalizeAlertStage("unknown"), "high_alert");
    assert.equal(normalizeAlertStage(null), "high_alert");
});

test("alert stage helpers expose stable launch-critical timing", () => {
    assert.equal(getEscalationLevel("monitoring"), 1);
    assert.equal(getEscalationLevel("critical"), 4);
    assert.equal(getAlertStageLabel("soft_alert"), "Help Needed");
    assert.equal(getNextEscalationPlan("soft_alert"), null);
    assert.equal(getNextEscalationPlan("high_alert"), null);
    assert.equal(getCancelWindowMs("soft_alert"), 0);
    assert.equal(getCancelWindowMs("high_alert"), 0);
});
