"use strict";

var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length,
        r = c < 3 ? target : desc === null
            ? desc = Object.getOwnPropertyDescriptor(target, key)
            : desc,
        d;

    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") {
        r = Reflect.decorate(decorators, target, key, desc);
    } else {
        for (var i = decorators.length - 1; i >= 0; i--) {
            if (d = decorators[i]) {
                r = (c < 3
                    ? d(r)
                    : c > 3
                        ? d(target, key, r)
                        : d(target, key)) || r;
            }
        }
    }

    return c > 3 &&
        r &&
        Object.defineProperty(target, key, r),
        r;
};

var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") {
        return Reflect.metadata(k, v);
    }
};

Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertsService = void 0;

const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const queues_service_1 = require("../queues/queues.service");
const ws_service_1 = require("../ws/ws.service");
const privacy_1 = require("../common/privacy");
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
        .map((item) => typeof item === "string" ? item.trim() : "")
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
        detectionSummary: Array.isArray(row.detection_summary)
            ? row.detection_summary
            : [],
    };
}

function mapAlertHistoryRow(row) {
    return {
        id: row.id,
        userId: row.user_id,
        type: row.type,
        severity: row.severity,
        message: row.message,
        status: row.status,
        triggerSource: row.trigger_source,
        stage: row.stage,
        escalationLevel: row.escalation_level,
        riskScore: row.risk_score == null
            ? 0
            : Number(row.risk_score),
        riskSnapshot: row.risk_snapshot || {},
        detectionSummary: Array.isArray(row.detection_summary)
            ? row.detection_summary
            : [],
        createdAt: row.created_at || null,
        resolvedAt: row.resolved_at || null,
        cancelExpiresAt: row.cancel_expires_at || null,
        escalatedAt: row.escalated_at || null,

        session: row.session_id
            ? {
                id: row.session_id,
                status: row.session_status || null,
                startedAt: row.session_started_at || null,
                endedAt: row.session_ended_at || null,
                lastLocationAt:
                    row.session_last_location_at || null,
            }
            : null,

        latestAudit: row.latest_audit_event_type
            ? {
                eventType: row.latest_audit_event_type,
                source: row.latest_audit_source || null,
                createdAt:
                    row.latest_audit_created_at || null,
            }
            : null,
    };
}

async function recordAlertAudit(
    queryable,
    {
        alertId,
        sessionId,
        userId,
        eventType,
        source,
        fromStage,
        toStage,
        metadata,
    },
) {
    if (!alertId || !eventType) {
        return;
    }

    await queryable.query(`
      insert into alert_audit_events (
        alert_id,
        session_id,
        user_id,
        event_type,
        source,
        from_stage,
        to_stage,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `, [
        alertId,
        sessionId || null,
        userId || null,
        eventType,
        source || "system",
        fromStage || null,
        toStage || null,
        JSON.stringify(
            (0, privacy_1.sanitizeAuditMetadata)(metadata),
        ),
    ]);
}

async function bestEffort(work, onError) {
    try {
        await work();
    }
    catch (error) {
        onError(error);
    }
}

let AlertsService = class AlertsService {
    constructor(db, queues, ws) {
        this.db = db;
        this.queues = queues;
        this.ws = ws;
        this.logger = new common_1.Logger(AlertsService.name);
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
      where s.user_id = $1
        and s.status = 'active'
      order by s.started_at desc
      limit 1
    `, [userId]);

        return activeResult.rows[0] || null;
    }

    /*
     * Return the authenticated user's emergency alert history.
     *
     * This is intentionally separate from the reviewer/admin
     * history endpoint. The user can only retrieve alerts where
     * alerts.user_id matches their authenticated user id.
     *
     * PostgreSQL is the source of truth. Zustand is no longer
     * responsible for permanent emergency history.
     */
    async history(userId, limit = 40) {
        const parsedLimit = Number.parseInt(limit, 10);

        const safeLimit = Number.isFinite(parsedLimit)
            ? Math.min(Math.max(parsedLimit, 1), 100)
            : 40;

        const result = await this.db.query(`
      select
        a.id,
        a.user_id,
        a.type,
        a.severity,
        a.message,
        a.status,
        a.trigger_source,
        a.stage,
        a.escalation_level,
        a.risk_score,
        a.risk_snapshot,
        a.detection_summary,
        a.created_at,
        a.resolved_at,
        a.cancel_expires_at,
        a.escalated_at,

        s.id as session_id,
        s.status as session_status,
        s.started_at as session_started_at,
        s.ended_at as session_ended_at,
        s.last_location_at as session_last_location_at,

        audit.event_type as latest_audit_event_type,
        audit.source as latest_audit_source,
        audit.created_at as latest_audit_created_at

      from alerts a

      left join lateral (
        select
          ws.id,
          ws.status,
          ws.started_at,
          ws.ended_at,
          ws.last_location_at
        from watch_sessions ws
        where ws.alert_id = a.id
          and ws.user_id = a.user_id
        order by ws.started_at desc nulls last
        limit 1
      ) s on true

      left join lateral (
        select
          ae.event_type,
          ae.source,
          ae.created_at
        from alert_audit_events ae
        where ae.alert_id = a.id
          and ae.user_id = a.user_id
        order by ae.created_at desc
        limit 1
      ) audit on true

      where a.user_id = $1

      order by a.created_at desc

      limit $2
    `, [
            userId,
            safeLimit,
        ]);

        return result.rows.map(mapAlertHistoryRow);
    }

    async create(userId, body) {
        console.log("[ALERT USER DEBUG]", {
            userId,
            userIdType: typeof userId,
        });

        const active = await this.findActiveAlert(userId);

        if (active) {
            return mapAlertSessionRow(active);
        }

        const triggerSource =
            typeof body?.triggerSource === "string" &&
            body.triggerSource.trim()
                ? body.triggerSource.trim().toLowerCase()
                : "panic";

        /*
         * SOS/panic starts as Soft Alert.
         */
        const alertStage = (0, alert_stages_1.normalizeAlertStage)(
            body?.stage || "soft_alert",
        );

        const escalationLevel =
            (0, alert_stages_1.getEscalationLevel)(alertStage);

        const severity =
            (0, alert_stages_1.getAlertSeverity)(alertStage);

        const riskScore = clampRiskScore(body?.riskScore);

        const riskSnapshot =
            body?.riskSnapshot &&
            typeof body.riskSnapshot === "object"
                ? body.riskSnapshot
                : {};

        const detectionSummary =
            sanitizeDetectionSummary(body?.detectionSummary);

        const cancelWindowMs = 0;

        const created = await this.db.transaction(async (client) => {
            const alertResult = await client.query(`
        insert into alerts (
          user_id,
          type,
          severity,
          message,
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
          $2,
          $3,
          $4,
          'active',
          $5,
          $6,
          $7,
          $8,
          $9::jsonb,
          $10::jsonb,
          null
        )
        returning *
      `, [
                userId,
                triggerSource,
                severity,
                `Sentinel ${alertStage.replace("_", " ")} alert`,
                triggerSource,
                escalationLevel,
                alertStage,
                riskScore,
                JSON.stringify(riskSnapshot),
                JSON.stringify(detectionSummary),
            ]);

            const alert = alertResult.rows[0];

            const sessionResult = await client.query(`
        insert into watch_sessions (
          owner_id,
          alert_id,
          user_id,
          status,
          escalation_level
        )
        values ($2, $1, $2, 'active', $3)
        returning *
      `, [
                alert.id,
                userId,
                escalationLevel,
            ]);

            const session = sessionResult.rows[0];

            await recordAlertAudit(client, {
                alertId: alert.id,
                sessionId: session.id,
                userId,
                eventType: "alert_created",
                source: triggerSource,
                toStage: alertStage,
                metadata: {
                    severity,
                    escalationLevel,
                    riskScore,
                    cancelWindowMs,
                    detectionSummaryCount:
                        detectionSummary.length,
                },
            });

            return {
                alert,
                session,
            };
        });

        const alertId = created.alert.id;
        const sessionId = created.session.id;

        this.logger.log(
            `alert_created alertId=${alertId} ` +
            `sessionId=${sessionId} ` +
            `userId=${userId} ` +
            `stage=${alertStage} ` +
            `severity=${created.alert.severity} ` +
            `escalationLevel=${created.alert.escalation_level} ` +
            `trigger=${triggerSource}`,
        );

        await bestEffort(
            () => this.queues.scheduleEscalation({
                alertId,
                sessionId,
                stage: alertStage,
            }),
            (error) => {
                this.logger.error(
                    `Alert escalation scheduling failed after create: ${
                        error instanceof Error
                            ? error.message
                            : "unknown error"
                    }`,
                );
            },
        );

        this.ws.emitSessionStatus(
            sessionId,
            "active",
            alertStage,
        );

        if (
            (0, alert_stages_1.compareAlertStages)(
                alertStage,
                "high_alert",
            ) >= 0
        ) {
            this.queues.enqueueAlertNotifications({
                userId,
                alertId,
                sessionId,
                eventType: "alert_started",
                stage: alertStage,
                triggerSource,
                riskScore,
                cancelExpiresAt: null,
                detectionSummary,
            }).catch((error) => {
                common_1.Logger.warn(
                    `Alert notification dispatch failed: ${
                        error instanceof Error
                            ? error.message
                            : "unknown error"
                    }`,
                    "AlertsService",
                );
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
        const requestedStage =
            (0, alert_stages_1.normalizeAlertStage)(
                body?.stage ||
                body?.targetStage ||
                "high_alert",
            );

        const result = await this.db.transaction(async (client) => {
            const currentResult = await client.query(`
        select
          a.id as alert_id,
          a.status as alert_status,
          a.trigger_source,
          a.stage,
          a.escalation_level,
          a.severity,
          a.risk_score,
          a.risk_snapshot,
          a.detection_summary,
          a.cancel_expires_at,
          a.created_at,
          s.id as session_id,
          s.started_at
        from alerts a
        left join watch_sessions s
          on s.alert_id = a.id
          and s.status = 'active'
        where a.id = $1
          and a.user_id = $2
          and a.status = 'active'
        limit 1
      `, [
                id,
                userId,
            ]);

            const current = currentResult.rows[0];

            if (!current) {
                throw new common_1.NotFoundException(
                    "Active alert not found",
                );
            }

            if (
                (0, alert_stages_1.compareAlertStages)(
                    requestedStage,
                    current.stage,
                ) <= 0
            ) {
                return {
                    ...current,
                    didEscalate: false,
                };
            }

            const escalationLevel =
                (0, alert_stages_1.getEscalationLevel)(
                    requestedStage,
                );

            const severity =
                (0, alert_stages_1.getAlertSeverity)(
                    requestedStage,
                );

            const riskScore =
                body?.riskScore == null
                    ? current.risk_score
                    : Math.max(
                        clampRiskScore(current.risk_score),
                        clampRiskScore(body?.riskScore),
                    );

            const riskSnapshot =
                body?.riskSnapshot &&
                typeof body.riskSnapshot === "object"
                    ? body.riskSnapshot
                    : current.risk_snapshot || {};

            const detectionSummary = (() => {
                const requested =
                    sanitizeDetectionSummary(
                        body?.detectionSummary,
                    );

                if (requested.length > 0) {
                    return requested;
                }

                return Array.isArray(current.detection_summary)
                    ? current.detection_summary
                    : [];
            })();

            const alertResult = await client.query(`
        update alerts
        set
          stage = $1,
          escalation_level = $2,
          severity = $3,
          risk_score = $4,
          risk_snapshot = $5::jsonb,
          detection_summary = $6::jsonb,
          cancel_expires_at = null,
          escalated_at = now()
        where id = $7
          and user_id = $8
          and status = 'active'
        returning *
      `, [
                requestedStage,
                escalationLevel,
                severity,
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
        where alert_id = $2
          and user_id = $3
          and status = 'active'
      `, [
                escalationLevel,
                id,
                userId,
            ]);

            await recordAlertAudit(client, {
                alertId: alert.id,
                sessionId: current.session_id,
                userId,
                eventType: "alert_escalated",
                source: body?.source || "user",
                fromStage: current.stage,
                toStage: requestedStage,
                metadata: {
                    severity,
                    escalationLevel,
                    riskScore,
                    detectionSummaryCount:
                        detectionSummary.length,
                    previousRiskScore:
                        current.risk_score,
                    previousSeverity:
                        current.severity || null,
                },
            });

            return {
                ...alert,
                alert_id: alert.id,
                alert_status: alert.status,
                session_id: current.session_id,
                started_at: current.started_at,
                didEscalate: true,
            };
        });

        if (
            result.session_id &&
            result.didEscalate
        ) {
            this.logger.warn(
                `alert_escalated ` +
                `alertId=${result.alert_id} ` +
                `sessionId=${result.session_id} ` +
                `userId=${userId} ` +
                `stage=${result.stage} ` +
                `severity=${result.severity} ` +
                `escalationLevel=${result.escalation_level}`,
            );

            await bestEffort(
                () => this.queues.scheduleEscalation({
                    alertId: result.alert_id,
                    sessionId: result.session_id,
                    stage: result.stage,
                }),
                (error) => {
                    this.logger.error(
                        `Alert escalation scheduling failed after manual escalation: ${
                            error instanceof Error
                                ? error.message
                                : "unknown error"
                        }`,
                    );
                },
            );

            this.ws.emitSessionStatus(
                result.session_id,
                "active",
                result.stage,
            );

            if (
                (0, alert_stages_1.compareAlertStages)(
                    result.stage,
                    "high_alert",
                ) >= 0
            ) {
                this.queues.enqueueAlertNotifications({
                    userId,
                    alertId: result.alert_id,
                    sessionId: result.session_id,
                    eventType: "alert_escalated",
                    stage: result.stage,
                    triggerSource: result.trigger_source,
                    riskScore: result.risk_score,
                    cancelExpiresAt: null,
                    detectionSummary:
                        Array.isArray(result.detection_summary)
                            ? result.detection_summary
                            : [],
                }).catch((error) => {
                    common_1.Logger.warn(
                        `Alert escalation notification failed: ${
                            error instanceof Error
                                ? error.message
                                : "unknown error"
                        }`,
                        "AlertsService",
                    );
                });
            }
        }

        return mapAlertSessionRow(result);
    }

    async cancel(userId, id, body = {}) {
        const result = await this.db.transaction(async (client) => {
            const alertResult = await client.query(`
        update alerts
        set
          status = 'cancelled',
          resolved_at = now()
        where id = $1
          and user_id = $2
          and status = 'active'
        returning *
      `, [
                id,
                userId,
            ]);

            const alert = alertResult.rows[0];

            if (!alert) {
                throw new common_1.NotFoundException(
                    "Active alert not found",
                );
            }

            const sessionResult = await client.query(`
        update watch_sessions
        set
          status = 'cancelled',
          ended_at = now()
        where alert_id = $1
          and user_id = $2
          and status = 'active'
        returning id
      `, [
                id,
                userId,
            ]);

            const session =
                sessionResult.rows[0] || null;

            await recordAlertAudit(client, {
                alertId: alert.id,
                sessionId: session?.id || null,
                userId,
                eventType: "alert_cancelled",
                source: body?.source || "user",
                fromStage: alert.stage,
                toStage: "cancelled",
                metadata: {
                    riskScore: alert.risk_score,
                    triggerSource:
                        alert.trigger_source,
                    severity:
                        alert.severity || null,
                    escalationLevel:
                        alert.escalation_level ?? null,
                },
            });

            return {
                alert,
                session,
            };
        });

        await this.queues.cancelEscalation(id);

        this.logger.log(
            `alert_cancelled ` +
            `alertId=${id} ` +
            `sessionId=${result.session?.id ?? "none"} ` +
            `userId=${userId}`,
        );

        if (result.session?.id) {
            this.ws.emitSessionStatus(
                result.session.id,
                "cancelled",
                "cancelled",
            );
        }

        this.queues.enqueueAlertNotifications({
            userId,
            alertId: id,
            sessionId: result.session?.id ?? null,
            eventType: "alert_cancelled",
            stage: result.alert.stage || null,
            triggerSource:
                result.alert.trigger_source || null,
            riskScore:
                result.alert.risk_score ?? null,
            cancelExpiresAt: null,
            detectionSummary:
                Array.isArray(
                    result.alert.detection_summary,
                )
                    ? result.alert.detection_summary
                    : [],
        }).catch((error) => {
            common_1.Logger.warn(
                `Alert cancellation notification failed: ${
                    error instanceof Error
                        ? error.message
                        : "unknown error"
                }`,
                "AlertsService",
            );
        });

        return {
            id,
            status: result.alert.status,
            sessionId:
                result.session?.id ?? null,
        };
    }
};

exports.AlertsService = AlertsService;

exports.AlertsService = AlertsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata(
        "design:paramtypes",
        [
            db_service_1.DbService,
            queues_service_1.QueuesService,
            ws_service_1.WsService,
        ],
    ),
], AlertsService);

//# sourceMappingURL=alerts.service.js.map