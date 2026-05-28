"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { AlertsService } = require("../src/alerts/alerts.service");

function createAlertDb() {
    const calls = [];
    const alert = {
        id: "alert-1",
        status: "active",
        trigger_source: "panic",
        stage: "high_alert",
        escalation_level: 2,
        risk_score: 91,
        risk_snapshot: { source: "device" },
        detection_summary: ["panic button pressed"],
        cancel_expires_at: null,
        created_at: "2026-05-21T10:00:00.000Z",
    };
    const session = {
        id: "session-1",
        alert_id: "alert-1",
        user_id: "user-1",
        status: "active",
        escalation_level: 2,
        started_at: "2026-05-21T10:00:01.000Z",
    };

    return {
        calls,
        alert,
        session,
        async query(sql, params) {
            calls.push({ sql, params });
            if (sql.includes("from watch_sessions s") && sql.includes("where s.user_id = $1")) {
                return { rows: [] };
            }
            throw new Error(`Unexpected query: ${sql}`);
        },
        async transaction(callback) {
            const client = {
                async query(sql, params) {
                    calls.push({ sql, params });
                    if (sql.includes("insert into alerts")) {
                        return { rows: [alert] };
                    }
                    if (sql.includes("insert into watch_sessions")) {
                        return { rows: [session] };
                    }
                    if (sql.includes("insert into alert_audit_events")) {
                        return { rows: [] };
                    }
                    throw new Error(`Unexpected query: ${sql}`);
                },
            };
            return callback(client);
        },
    };
}

function createCancelDb({ alert, session }) {
    const calls = [];
    return {
        calls,
        async transaction(callback) {
            const client = {
                async query(sql, params) {
                    calls.push({ sql, params });
                    if (sql.includes("update alerts")) {
                        return { rows: [alert] };
                    }
                    if (sql.includes("update watch_sessions")) {
                        return { rows: [session] };
                    }
                    if (sql.includes("insert into alert_audit_events")) {
                        return { rows: [] };
                    }
                    throw new Error(`Unexpected query: ${sql}`);
                },
            };
            return callback(client);
        },
    };
}

test("create returns an active alert even when escalation scheduling fails after commit", async () => {
    const db = createAlertDb();
    const queueCalls = [];
    const socketCalls = [];
    const service = new AlertsService(
        db,
        {
            async scheduleEscalation(payload) {
                queueCalls.push(["scheduleEscalation", payload]);
                throw new Error("redis unavailable");
            },
            enqueueAlertNotifications(payload) {
                queueCalls.push(["enqueueAlertNotifications", payload]);
                return Promise.resolve();
            },
        },
        {
            emitSessionStatus(sessionId, status, stage) {
                socketCalls.push([sessionId, status, stage]);
            },
        },
    );

    const result = await service.create("user-1", {
        triggerSource: "panic",
        riskScore: 91,
        detectionSummary: ["panic button pressed"],
    });

    assert.equal(result.alertId, "alert-1");
    assert.equal(result.sessionId, "session-1");
    assert.equal(result.alertStage, "high_alert");
    assert.deepEqual(socketCalls, [["session-1", "active", "high_alert"]]);
    assert.equal(queueCalls[0][0], "scheduleEscalation");
    assert.equal(queueCalls[1][0], "enqueueAlertNotifications");
});

test("cancel closes the alert, records audit, emits status, and cancels escalation", async () => {
    const db = createCancelDb({
        alert: {
            id: "alert-1",
            status: "cancelled",
            stage: "high_alert",
            risk_score: 88,
            trigger_source: "panic",
            detection_summary: ["manual sos"],
        },
        session: { id: "session-1" },
    });
    const queueCalls = [];
    const socketCalls = [];
    const service = new AlertsService(
        db,
        {
            async cancelEscalation(alertId) {
                queueCalls.push(["cancelEscalation", alertId]);
            },
            enqueueAlertNotifications(payload) {
                queueCalls.push(["enqueueAlertNotifications", payload]);
                return Promise.resolve();
            },
        },
        {
            emitSessionStatus(sessionId, status, stage) {
                socketCalls.push([sessionId, status, stage]);
            },
        },
    );

    const result = await service.cancel("user-1", "alert-1");

    assert.deepEqual(result, {
        id: "alert-1",
        status: "cancelled",
        sessionId: "session-1",
    });
    assert.deepEqual(queueCalls[0], ["cancelEscalation", "alert-1"]);
    assert.equal(queueCalls[1][0], "enqueueAlertNotifications");
    assert.equal(queueCalls[1][1].eventType, "alert_cancelled");
    assert.deepEqual(socketCalls, [["session-1", "cancelled", "cancelled"]]);

    const auditCall = db.calls.find((call) => call.sql.includes("insert into alert_audit_events"));
    assert.ok(auditCall);
    assert.equal(auditCall.params[4], "user");
    assert.equal(auditCall.params[6], "cancelled");
});
