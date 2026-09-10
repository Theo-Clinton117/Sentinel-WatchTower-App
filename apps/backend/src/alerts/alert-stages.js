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

const ALERT_STAGE_ORDER = [
    'monitoring',
    'suspicious',
    'soft_alert',
    'high_alert',
    'critical',
];

exports.ALERT_STAGE_ORDER = ALERT_STAGE_ORDER;

function normalizeAlertStage(value) {
    if (typeof value !== 'string') {
        return 'high_alert';
    }

    const normalized = value.trim().toLowerCase();

    return ALERT_STAGE_ORDER.includes(normalized)
        ? normalized
        : 'high_alert';
}

exports.normalizeAlertStage = normalizeAlertStage;

function compareAlertStages(left, right) {
    return (
        ALERT_STAGE_ORDER.indexOf(normalizeAlertStage(left)) -
        ALERT_STAGE_ORDER.indexOf(normalizeAlertStage(right))
    );
}

exports.compareAlertStages = compareAlertStages;

function getEscalationLevel(stage) {
    switch (normalizeAlertStage(stage)) {
        case 'monitoring':
            return 0;

        case 'suspicious':
            return 1;

        case 'soft_alert':
            return 2;

        case 'high_alert':
            return 3;

        case 'critical':
            return 4;

        default:
            return 3;
    }
}

exports.getEscalationLevel = getEscalationLevel;

/**
 * Severity is derived from the escalation stage.
 *
 * monitoring  -> Low
 * suspicious  -> Low
 * soft_alert  -> Moderate
 * high_alert  -> High
 * critical    -> Critical
 */
function getAlertSeverity(stage) {
    switch (normalizeAlertStage(stage)) {
        case 'monitoring':
        case 'suspicious':
            return 'Low';

        case 'soft_alert':
            return 'Moderate';

        case 'high_alert':
            return 'High';

        case 'critical':
            return 'Critical';

        default:
            return 'High';
    }
}

exports.getAlertSeverity = getAlertSeverity;

function getAlertStageLabel(stage) {
    switch (normalizeAlertStage(stage)) {
        case 'monitoring':
            return 'Monitoring';

        case 'suspicious':
            return 'Suspicious';

        case 'soft_alert':
            return 'Soft Alert';

        case 'high_alert':
            return 'High Alert';

        case 'critical':
            return 'Critical';

        default:
            return 'High Alert';
    }
}

exports.getAlertStageLabel = getAlertStageLabel;

function getNextEscalationPlan(stage) {
    switch (normalizeAlertStage(stage)) {
        case 'soft_alert':
            return {
                targetStage: 'high_alert',
                delayMs: 10 * 1000,
            };

        case 'high_alert':
            return {
                targetStage: 'critical',
                delayMs: 3 * 60 * 1000,
            };

        default:
            return null;
    }
}

exports.getNextEscalationPlan = getNextEscalationPlan;

function getCancelWindowMs(stage) {
    return normalizeAlertStage(stage) === 'soft_alert'
        ? 10 * 1000
        : 0;
}

exports.getCancelWindowMs = getCancelWindowMs;