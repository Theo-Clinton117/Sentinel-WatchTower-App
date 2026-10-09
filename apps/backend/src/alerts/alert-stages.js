"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

exports.getCancelWindowMs =
    exports.getNextEscalationPlan =
    exports.getAlertSeverity =
    exports.getAlertStageLabel =
    exports.getEscalationLevel =
    exports.compareAlertStages =
    exports.normalizeAlertStage =
    exports.ALERT_STAGE_ORDER =
    void 0;

/**
 * Alert stages are ordered from least severe to most severe.
 *
 * monitoring
 *     ↓
 * suspicious
 *     ↓
 * soft_alert
 *     ↓
 * high_alert
 *     ↓
 * high_alert
 */
const ALERT_STAGE_ORDER = [
    "monitoring",
    "suspicious",
    "soft_alert",
    "high_alert",
];

exports.ALERT_STAGE_ORDER = ALERT_STAGE_ORDER;

/**
 * Normalize an incoming stage to one of the supported stages.
 *
 * The former `critical` value is retained as an input alias for existing
 * records, but Level 4 (high_alert) is the highest active escalation.
 * malformed escalation requests cannot accidentally create
 * an undefined or unsafe stage.
 */
function normalizeAlertStage(value) {
    if (typeof value !== "string") {
        return "high_alert";
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === "critical") {
        return "high_alert";
    }
    return ALERT_STAGE_ORDER.includes(normalized) ? normalized : "high_alert";
}

exports.normalizeAlertStage = normalizeAlertStage;

/**
 * Compare two alert stages.
 *
 * Returns:
 *   < 0  left is less severe than right
 *   = 0  both stages are equal
 *   > 0  left is more severe than right
 */
function compareAlertStages(left, right) {
    return (
        ALERT_STAGE_ORDER.indexOf(
            normalizeAlertStage(left),
        ) -
        ALERT_STAGE_ORDER.indexOf(
            normalizeAlertStage(right),
        )
    );
}

exports.compareAlertStages = compareAlertStages;

/**
 * Convert an alert stage into its numeric escalation level.
 *
 * 1 = Monitoring, 2 = Concern, 3 = Help Needed, 4 = Immediate Danger.
 */
function getEscalationLevel(stage) {
    switch (normalizeAlertStage(stage)) {
        case "monitoring":
            return 1;

        case "suspicious":
            return 2;

        case "soft_alert":
            return 3;

        case "high_alert":
            return 4;

        default:
            return 4;
    }
}

exports.getEscalationLevel = getEscalationLevel;

/**
 * Severity is derived directly from the escalation stage.
 *
 * monitoring  -> Low
 * suspicious  -> Moderate
 * soft_alert  -> High
 * high_alert  -> Critical
 */
function getAlertSeverity(stage) {
    switch (normalizeAlertStage(stage)) {
        case "monitoring":
        case "suspicious":
            return "Moderate";

        case "soft_alert":
            return "High";

        case "high_alert":
            return "Critical";

        default:
            return "High";
    }
}

exports.getAlertSeverity = getAlertSeverity;

/**
 * Human-readable labels for the mobile UI, notifications,
 * reviewer dashboard, and audit surfaces.
 */
function getAlertStageLabel(stage) {
    switch (normalizeAlertStage(stage)) {
        case "monitoring":
            return "Monitoring";

        case "suspicious":
            return "Concern";

        case "soft_alert":
            return "Help Needed";

        case "high_alert":
            return "Immediate Danger";

        default:
            return "High Alert";
    }
}

exports.getAlertStageLabel = getAlertStageLabel;

/**
 * Determine whether the backend should automatically escalate
 * an alert after a period of time.
 *
 * IMPORTANT:
 *
 * Escalation is always an explicit user decision. Sentinel must not convert a
 * private safety check into a wider emergency on a timer.
 */
function getNextEscalationPlan() { return null; }

exports.getNextEscalationPlan = getNextEscalationPlan;

/**
 * There is no automatic cancellation window.
 *
 * The user explicitly controls the alert lifecycle through
 * the emergency UI:
 *
 * - Keep monitoring
 * - Escalate to Concern, Help Needed, or Immediate Danger
 * - I'm Safe / End Alert
 *
 * Cancellation is therefore handled explicitly by the
 * AlertsService.cancel() flow.
 */
function getCancelWindowMs() { return 0; }

exports.getCancelWindowMs = getCancelWindowMs;
