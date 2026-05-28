"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const { runMigrations } = require("../../../../scripts/run-migrations");
const { AlertsService } = require("../../src/alerts/alerts.service");
const { SessionsService } = require("../../src/sessions/sessions.service");
const { DbService } = require("../../src/db/db.service");

function getTestDatabaseUrl() {
    return String(process.env.TEST_DATABASE_URL || "").trim();
}

function isAllowedTestDatabase(connectionString) {
    if (process.env.ALLOW_NON_TEST_DB_INTEGRATION === "1") {
        return true;
    }
    try {
        const databaseName = new URL(connectionString).pathname.replace(/^\//, "");
        return /test/i.test(databaseName);
    }
    catch {
        return false;
    }
}

async function cleanup(pool, userId) {
    await pool.query("delete from users where id = $1", [userId]);
}

test("emergency alert lifecycle persists audit events end to end", {
    skip: !getTestDatabaseUrl()
        ? "Set TEST_DATABASE_URL to a disposable Postgres database to run integration tests."
        : !isAllowedTestDatabase(getTestDatabaseUrl())
            ? "TEST_DATABASE_URL database name must contain 'test' or set ALLOW_NON_TEST_DB_INTEGRATION=1."
            : false,
}, async () => {
    const connectionString = getTestDatabaseUrl();
    await runMigrations({
        connectionString,
        supabaseCompat: true,
        log: () => undefined,
    });

    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousSupabaseDbUrl = process.env.SUPABASE_DB_URL;
    const previousDbSslMode = process.env.DB_SSL_MODE;
    process.env.DATABASE_URL = connectionString;
    delete process.env.SUPABASE_DB_URL;
    process.env.DB_SSL_MODE = process.env.TEST_DB_SSL_MODE || "disable";

    const pool = new Pool({ connectionString });
    const db = new DbService();
    const queueCalls = [];
    const socketCalls = [];
    const queues = {
        async scheduleEscalation(payload) {
            queueCalls.push(["scheduleEscalation", payload]);
        },
        async cancelEscalation(alertId) {
            queueCalls.push(["cancelEscalation", alertId]);
        },
        enqueueAlertNotifications(payload) {
            queueCalls.push(["enqueueAlertNotifications", payload]);
            return Promise.resolve();
        },
    };
    const ws = {
        emitSessionStatus(sessionId, status, stage) {
            socketCalls.push([sessionId, status, stage]);
        },
    };
    const alerts = new AlertsService(db, queues, ws);
    const sessions = new SessionsService(db, queues, ws);

    let userId;
    try {
        const userResult = await pool.query(
            "insert into users (email, name) values ($1, $2) returning id",
            [`integration-${Date.now()}@example.com`, "Integration User"],
        );
        userId = userResult.rows[0].id;

        const created = await alerts.create(userId, {
            triggerSource: "panic",
            riskScore: 88,
            detectionSummary: ["integration panic"],
        });
        assert.equal(created.alertStage, "high_alert");
        assert.ok(created.alertId);
        assert.ok(created.sessionId);

        const closed = await sessions.close(userId, created.sessionId);
        assert.equal(closed.status, "completed");
        assert.equal(closed.alertStatus, "resolved");

        const auditResult = await pool.query(
            "select event_type, to_stage from alert_audit_events where alert_id = $1 order by created_at asc",
            [created.alertId],
        );
        assert.deepEqual(auditResult.rows.map((row) => row.event_type), [
            "alert_created",
            "session_closed",
        ]);
        assert.equal(auditResult.rows[1].to_stage, "resolved");
        assert.deepEqual(socketCalls, [
            [created.sessionId, "active", "high_alert"],
            [created.sessionId, "resolved", "high_alert"],
        ]);
        assert.equal(queueCalls.some((call) => call[0] === "scheduleEscalation"), true);
        assert.equal(queueCalls.some((call) => call[0] === "cancelEscalation"), true);
    }
    finally {
        if (userId) {
            await cleanup(pool, userId);
        }
        await db.onModuleDestroy();
        await pool.end();
        if (previousDatabaseUrl === undefined) {
            delete process.env.DATABASE_URL;
        }
        else {
            process.env.DATABASE_URL = previousDatabaseUrl;
        }
        if (previousSupabaseDbUrl === undefined) {
            delete process.env.SUPABASE_DB_URL;
        }
        else {
            process.env.SUPABASE_DB_URL = previousSupabaseDbUrl;
        }
        if (previousDbSslMode === undefined) {
            delete process.env.DB_SSL_MODE;
        }
        else {
            process.env.DB_SSL_MODE = previousDbSslMode;
        }
    }
});
