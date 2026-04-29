"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertsService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const queues_service_1 = require("../queues/queues.service");
const ws_service_1 = require("../ws/ws.service");
const alert_stages_1 = require("./alert-stages");
function clampRiskScore(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(parsed)));
}
function sanitizeDetectionSummary(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => typeof item === 'string' ? item.trim() : '')
        .filter((item) => item.length > 0)
        .slice(0, 8);
}
function mapAlertSessionRow(row) {
    return {
        alertId: row.alert_id,
        sessionId: row.session_id,
        status: row.alert_status || row.status,
        triggerSource: row.trigger_source,
        alertStage: (0, alert_stages_1.normalizeAlertStage)(row.stage),
        escalationLevel: row.escalation_level,
        startedAt: row.started_at || row.created_at || null,
        alertStatus: row.alert_status || row.status || null,
        riskScore: row.risk_score == null ? 0 : Number(row.risk_score),
        cancelExpiresAt: row.cancel_expires_at || null,
        riskSnapshot: row.risk_snapshot || {},
        detectionSummary: Array.isArray(row.detection_summary) ? row.detection_summary : [],
    };
}
let AlertsService = class AlertsService {
    constructor(db, queues, ws) {
        this.db = db;
        this.queues = queues;
        this.ws = ws;
    }
    async findActiveAlert(userId) {
        const activeResult = await this.db.query(`
      select
        s.id as session_id,
        s.started_at,
        a.id as alert_id,
        a.status as alert_status,
        a.trigger_source,
        a.stage,
        a.escalation_level,
        a.risk_score,
        a.risk_snapshot,
        a.detection_summary,
        a.cancel_expires_at,
        a.created_at
      from watch_sessions s
      join alerts a on a.id = s.alert_id
      where s.user_id = $1 and s.status = 'active'
      order by s.started_at desc
      limit 1
    `, [userId]);
        return activeResult.rows[0] || null;
    }
    async create(userId, body) {
        const active = await this.findActiveAlert(userId);
        if (active) {
            return mapAlertSessionRow(active);
        }
        const triggerSource = typeof body?.triggerSource === 'string' && body.triggerSource.trim()
            ? body.triggerSource.trim().toLowerCase()
            : 'panic';
        let alertStage = (0, alert_stages_1.normalizeAlertStage)(body?.stage || (triggerSource === 'panic' ? 'high_alert' : 'soft_alert'));
        if (triggerSource === 'panic' && (0, alert_stages_1.compareAlertStages)(alertStage, 'high_alert') < 0) {
            alertStage = 'high_alert';
        }
        const escalationLevel = (0, alert_stages_1.getEscalationLevel)(alertStage);
        const riskScore = clampRiskScore(body?.riskScore);
        const riskSnapshot = body?.riskSnapshot && typeof body.riskSnapshot === 'object' ? body.riskSnapshot : {};
        const detectionSummary = sanitizeDetectionSummary(body?.detectionSummary);
        const cancelWindowMs = alertStage === 'soft_alert'
            ? Math.max(3000, Number(body?.cancelWindowSeconds || 10) * 1000)
            : 0;
        const created = await this.db.transaction(async (client) => {
            const alertResult = await client.query(`
        insert into alerts (
          user_id,
          status,
          trigger_source,
          escalation_level,
          stage,
          risk_score,
          risk_snapshot,
          detection_summary,
          cancel_expires_at
        )
        values (
          $1,
          'active',
          $2,
          $3,
          $4,
          $5,
          $6::jsonb,
          $7::jsonb,
          case when $8::int > 0 then now() + ($8::int * interval '1 millisecond') else null end
        )
        returning *
      `, [
                userId,
                triggerSource,
                escalationLevel,
                alertStage,
                riskScore,
                JSON.stringify(riskSnapshot),
                JSON.stringify(detectionSummary),
                cancelWindowMs,
            ]);
            const alert = alertResult.rows[0];
            const sessionResult = await client.query(`
        insert into watch_sessions (alert_id, user_id, status, escalation_level)
        values ($1, $2, 'active', $3)
        returning *
      `, [alert.id, userId, escalationLevel]);
            return { alert, session: sessionResult.rows[0] };
        });
        const alertId = created.alert.id;
        const sessionId = created.session.id;
        await this.queues.scheduleEscalation({ alertId, sessionId, stage: alertStage });
        this.ws.emitSessionStatus(sessionId, 'active', alertStage);
        if ((0, alert_stages_1.compareAlertStages)(alertStage, 'high_alert') >= 0) {
            this.queues.enqueueAlertNotifications({
                userId,
                alertId,
                sessionId,
                eventType: 'alert_started',
                stage: alertStage,
                triggerSource,
                riskScore,
                cancelExpiresAt: created.alert.cancel_expires_at || null,
                detectionSummary,
            }).catch((error) => {
                common_1.Logger.warn(`Alert notification dispatch failed: ${error instanceof Error ? error.message : 'unknown error'}`, 'AlertsService');
            });
        }
        return mapAlertSessionRow({
            ...created.alert,
            alert_id: alertId,
            session_id: sessionId,
            alert_status: created.alert.status,
            started_at: created.session.started_at,
        });
    }
    async escalate(userId, id, body) {
        const requestedStage = (0, alert_stages_1.normalizeAlertStage)(body?.stage || body?.targetStage || 'high_alert');
        const result = await this.db.transaction(async (client) => {
            const currentResult = await client.query(`
        select
          a.id as alert_id,
          a.status as alert_status,
          a.trigger_source,
          a.stage,
          a.escalation_level,
          a.risk_score,
          a.risk_snapshot,
          a.detection_summary,
          a.cancel_expires_at,
          a.created_at,
          s.id as session_id,
          s.started_at
        from alerts a
        left join watch_sessions s on s.alert_id = a.id and s.status = 'active'
        where a.id = $1 and a.user_id = $2 and a.status = 'active'
        limit 1
      `, [id, userId]);
            const current = currentResult.rows[0];
            if (!current) {
                throw new common_1.NotFoundException('Active alert not found');
            }
            if ((0, alert_stages_1.compareAlertStages)(requestedStage, current.stage) <= 0) {
                return {
                    ...current,
                    didEscalate: false,
                };
            }
            const escalationLevel = (0, alert_stages_1.getEscalationLevel)(requestedStage);
            const riskScore = body?.riskScore == null
                ? current.risk_score
                : Math.max(clampRiskScore(current.risk_score), clampRiskScore(body?.riskScore));
            const riskSnapshot = body?.riskSnapshot && typeof body.riskSnapshot === 'object'
                ? body.riskSnapshot
                : current.risk_snapshot || {};
            const detectionSummary = (() => {
                const requested = sanitizeDetectionSummary(body?.detectionSummary);
                if (requested.length > 0) {
                    return requested;
                }
                return Array.isArray(current.detection_summary) ? current.detection_summary : [];
            })();
            const alertResult = await client.query(`
        update alerts
        set
          stage = $1,
          escalation_level = $2,
          risk_score = $3,
          risk_snapshot = $4::jsonb,
          detection_summary = $5::jsonb,
          cancel_expires_at = case when $1 = 'soft_alert' then now() + interval '10 seconds' else null end,
          escalated_at = now()
        where id = $6 and user_id = $7 and status = 'active'
        returning *
      `, [
                requestedStage,
                escalationLevel,
                riskScore,
                JSON.stringify(riskSnapshot),
                JSON.stringify(detectionSummary),
                id,
                userId,
            ]);
            const alert = alertResult.rows[0];
            await client.query(`
        update watch_sessions
        set escalation_level = $1
        where alert_id = $2 and user_id = $3 and status = 'active'
      `, [escalationLevel, id, userId]);
            return {
                ...alert,
                alert_id: alert.id,
                alert_status: alert.status,
                session_id: current.session_id,
                started_at: current.started_at,
                didEscalate: true,
            };
        });
        if (result.session_id && result.didEscalate) {
            await this.queues.scheduleEscalation({
                alertId: result.alert_id,
                sessionId: result.session_id,
                stage: result.stage,
            });
            this.ws.emitSessionStatus(result.session_id, 'active', result.stage);
            if ((0, alert_stages_1.compareAlertStages)(result.stage, 'high_alert') >= 0) {
                this.queues.enqueueAlertNotifications({
                    userId,
                    alertId: result.alert_id,
                    sessionId: result.session_id,
                    eventType: 'alert_escalated',
                    stage: result.stage,
                    triggerSource: result.trigger_source,
                    riskScore: result.risk_score,
                    cancelExpiresAt: result.cancel_expires_at || null,
                    detectionSummary: Array.isArray(result.detection_summary) ? result.detection_summary : [],
                }).catch((error) => {
                    common_1.Logger.warn(`Alert escalation notification dispatch failed: ${error instanceof Error ? error.message : 'unknown error'}`, 'AlertsService');
                });
            }
        }
        return mapAlertSessionRow(result);
    }
    async cancel(userId, id) {
        const result = await this.db.transaction(async (client) => {
            const alertResult = await client.query(`
        update alerts
        set status = 'cancelled', resolved_at = now()
        where id = $1 and user_id = $2 and status = 'active'
        returning *
      `, [id, userId]);
            const alert = alertResult.rows[0];
            if (!alert) {
                throw new common_1.NotFoundException('Active alert not found');
            }
            const sessionResult = await client.query(`
        update watch_sessions
        set status = 'cancelled', ended_at = now()
        where alert_id = $1 and user_id = $2 and status = 'active'
        returning id
      `, [id, userId]);
            return { alert, session: sessionResult.rows[0] || null };
        });
        await this.queues.cancelEscalation(id);
        if (result.session?.id) {
            this.ws.emitSessionStatus(result.session.id, 'cancelled', 'cancelled');
        }
        this.queues.enqueueAlertNotifications({
            userId,
            alertId: id,
            sessionId: result.session?.id ?? null,
            eventType: 'alert_cancelled',
            stage: result.alert.stage || null,
            triggerSource: result.alert.trigger_source || null,
            riskScore: result.alert.risk_score ?? null,
            cancelExpiresAt: null,
            detectionSummary: Array.isArray(result.alert.detection_summary) ? result.alert.detection_summary : [],
        }).catch((error) => {
            common_1.Logger.warn(`Alert cancellation notification dispatch failed: ${error instanceof Error ? error.message : 'unknown error'}`, 'AlertsService');
        });
        return { id, status: result.alert.status, sessionId: result.session?.id ?? null };
    }
};
exports.AlertsService = AlertsService;
exports.AlertsService = AlertsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService, queues_service_1.QueuesService, ws_service_1.WsService])
], AlertsService);
//# sourceMappingURL=alerts.service.js.map
