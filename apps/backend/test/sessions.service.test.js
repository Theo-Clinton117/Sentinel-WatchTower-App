"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { SessionsService } = require("../src/sessions/sessions.service");

function createCloseDb() {
    const calls = [];
    const session = {
        id: "session-1",
        alert_id: "alert-1",
        user_id: "user-1",
        status: "active",
        escalation_level: 2,
        started_at: "2026-05-21T10:00:00.000Z",
        ended_at: "2026-05-21T10:05:00.000Z",
        last_location_at: null,
    };
    const hydrated = {
        ...session,
        status: "completed",
        alert_status: "resolved",
        trigger_source: "panic",
        stage: "high_alert",
        risk_score: 85,
        risk_snapshot: {},
        detection_summary: ["panic button pressed"],
        cancel_expires_at: null,
    };

    return {
        calls,
        async transaction(callback) {
            const client = {
                async query(sql, params) {
                    calls.push({ sql, params });
                    if (sql.includes("update watch_sessions")) {
                        return { rows: [session] };
                    }
                    if (sql.includes("update alerts")) {
                        return { rows: [] };
                    }
                    if (sql.includes("from watch_sessions s")) {
                        return { rows: [hydrated] };
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

test("close resolves session, cancels escalation, emits websocket status, and records audit", async () => {
    const db = createCloseDb();
    const queueCalls = [];
    const socketCalls = [];
    const service = new SessionsService(
        db,
        {
            async cancelEscalation(alertId) {
                queueCalls.push(["cancelEscalation", alertId]);
            },
        },
        {
            emitSessionStatus(sessionId, status, stage) {
                socketCalls.push([sessionId, status, stage]);
            },
        },
    );

    const result = await service.close("user-1", "session-1");

    assert.equal(result.id, "session-1");
    assert.equal(result.status, "completed");
    assert.deepEqual(queueCalls, [["cancelEscalation", "alert-1"]]);
    assert.deepEqual(socketCalls, [["session-1", "resolved", "high_alert"]]);

    const auditCall = db.calls.find((call) => call.sql.includes("insert into alert_audit_events"));
    assert.ok(auditCall);
    assert.equal(auditCall.params[3], "session_closed");
    assert.equal(auditCall.params[4], "user");
    assert.equal(auditCall.params[6], "resolved");
});
