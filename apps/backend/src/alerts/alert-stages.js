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
 * critical
 */
const ALERT_STAGE_ORDER = [
    "monitoring",
    "suspicious",
    "soft_alert",
    "high_alert",
    "critical",
];

exports.ALERT_STAGE_ORDER = ALERT_STAGE_ORDER;

/**
 * Normalize an incoming stage to one of the supported stages.
 *
 * Unknown or invalid values default to high_alert so that
 * malformed escalation requests cannot accidentally create
 * an undefined or unsafe stage.
 */
function normalizeAlertStage(value) {
    if (typeof value !== "string") {
        return "high_alert";
    }

    const normalized = value.trim().toLowerCase();

    return ALERT_STAGE_ORDER.includes(normalized)
        ? normalized
        : "high_alert";
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
 * 0 = Monitoring
 * 1 = Suspicious
 * 2 = Soft Alert
 * 3 = High Alert
 * 4 = Critical
 */
function getEscalationLevel(stage) {
    switch (normalizeAlertStage(stage)) {
        case "monitoring":
            return 0;

        case "suspicious":
            return 1;

        case "soft_alert":
            return 2;

        case "high_alert":
            return 3;

        case "critical":
            return 4;

        default:
            return 3;
    }
}

exports.getEscalationLevel = getEscalationLevel;

/**
 * Severity is derived directly from the escalation stage.
 *
 * monitoring  -> Low
 * suspicious  -> Low
 * soft_alert  -> Moderate
 * high_alert  -> High
 * critical    -> Critical
 */
function getAlertSeverity(stage) {
    switch (normalizeAlertStage(stage)) {
        case "monitoring":
        case "suspicious":
            return "Low";

        case "soft_alert":
            return "Moderate";

        case "high_alert":
            return "High";

        case "critical":
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
            return "Suspicious";

        case "soft_alert":
            return "Soft Alert";

        case "high_alert":
            return "High Alert";

        case "critical":
            return "Critical";

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
 * Soft Alert does NOT automatically escalate.
 *
 * Suspicious does NOT automatically escalate.
 *
 * This allows the user to make a semi-manual decision after
 * pressing SOS rather than Sentinel immediately turning the
 * alert into a High Alert.
 *
 * High Alert DOES automatically escalate to Critical after
 * three minutes if it remains active.
 */
function getNextEscalationPlan(stage) {
    switch (normalizeAlertStage(stage)) {
        case "high_alert":
            return {
                targetStage: "critical",
                delayMs: 3 * 60 * 1000,
            };

        default:
            return null;
    }
}

exports.getNextEscalationPlan = getNextEscalationPlan;

/**
 * There is no automatic cancellation window.
 *
 * The user explicitly controls the alert lifecycle through
 * the emergency UI:
 *
 * - Keep monitoring
 * - Escalate to Suspicious
 * - Escalate to High Alert
 * - Escalate to Critical
 * - I'm Safe / End Alert
 *
 * Cancellation is therefore handled explicitly by the
 * AlertsService.cancel() flow.
 */
function getCancelWindowMs(stage) {
    return 0;
}

exports.getCancelWindowMs = getCancelWindowMs;