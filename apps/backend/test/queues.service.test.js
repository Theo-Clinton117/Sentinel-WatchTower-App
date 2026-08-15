"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { QueuesService } = require("../src/queues/queues.service");

function withEnv(patch, work) {
    const previous = {};
    for (const key of Object.keys(patch)) {
        previous[key] = process.env[key];
        if (patch[key] === undefined) {
            delete process.env[key];
        }
        else {
            process.env[key] = patch[key];
        }
    }
    return Promise.resolve()
        .then(work)
        .finally(() => {
            for (const key of Object.keys(patch)) {
                if (previous[key] === undefined) {
                    delete process.env[key];
                }
                else {
                    process.env[key] = previous[key];
                }
            }
        });
}

function createNotificationDb({ contacts }) {
    const notificationRecords = [];
    const auditRecords = [];
    const calls = [];
    return {
        calls,
        notificationRecords,
        auditRecords,
        async query(sql, params) {
            calls.push({ sql, params });
            if (sql.includes("from alerts a") && sql.includes("join users u")) {
                return {
                    rows: [{
                        alert_id: "alert-1",
                        user_id: "user-1",
                        alert_status: "active",
                        trigger_source: "panic",
                        stage: "high_alert",
                        risk_score: 87,
                        cancel_expires_at: null,
                        created_at: "2026-06-09T10:00:00.000Z",
                        session_id: "session-1",
                        owner_name: "Ada",
                        owner_email: "ada@example.com",
                        owner_phone: "+15550000001",
                    }],
                };
            }
            if (sql.includes("from trusted_contacts tc")) {
                return { rows: contacts };
            }
            if (sql.includes("from location_logs")) {
                return {
                    rows: [{
                        lat: 6.5244,
                        lng: 3.3792,
                        accuracy_m: 12,
                        recorded_at: "2026-06-09T10:01:00.000Z",
                    }],
                };
            }
            if (sql.includes("insert into notifications")) {
                notificationRecords.push({
                    userId: params[0],
                    type: params[1],
                    channel: params[2],
                    status: params[3],
                    payload: JSON.parse(params[4]),
                    relatedSessionId: params[5],
                });
                return { rows: [{ id: `notification-${notificationRecords.length}` }] };
            }
            if (sql.includes("insert into alert_audit_events")) {
                auditRecords.push({
                    alertId: params[0],
                    sessionId: params[1],
                    userId: params[2],
                    eventType: params[3],
                    source: params[4],
                    fromStage: params[5],
                    toStage: params[6],
                    metadata: JSON.parse(params[7]),
                });
                return { rows: [] };
            }
            throw new Error(`Unexpected query: ${sql}`);
        },
    };
}

test("processAlertContactNotifications records in-app, SMS, email, and audit delivery outcomes", async () => {
    await withEnv(
        {
            REDIS_URL: undefined,
            KUDISMS_TOKEN: "token",
            KUDISMS_SENDER_ID: "Sentinel",
            RESEND_API_KEY: "resend",
            OTP_EMAIL_FROM: "security@example.com",
        },
        async () => {
            const db = createNotificationDb({
                contacts: [{
                    id: "contact-1",
                    user_id: "user-1",
                    contact_user_id: "trusted-user-1",
                    contact_name: "Tola",
                    contact_phone: "+15550000003",
                    contact_email: "tola@example.com",
                    can_view_location: true,
                    can_sms: true,
                    linked_name: "Tola Linked",
                    linked_email: "linked@example.com",
                    linked_phone: "+15550000004",
                }],
            });
            const service = new QueuesService(db, {});
            const sentSms = [];
            const sentEmail = [];
            service.sendSms = async (to, body) => {
                sentSms.push({ to, body });
            };
            service.sendEmail = async (message) => {
                sentEmail.push(message);
            };

            try {
                const result = await service.processAlertContactNotifications({
                    userId: "user-1",
                    alertId: "alert-1",
                    eventType: "alert_started",
                    stage: "high_alert",
                    detectionSummary: ["panic button pressed", "high motion detected"],
                });

                assert.deepEqual(result, { ok: true, delivered: 3, contacts: 1 });
                assert.equal(sentSms.length, 1);
                assert.equal(sentEmail.length, 1);
                assert.equal(db.notificationRecords.length, 4);
                assert.deepEqual(db.notificationRecords.map((record) => record.channel).sort(), [
                    "email",
                    "in_app",
                    "in_app",
                    "sms",
                ]);
                const trustedRecord = db.notificationRecords.find((record) => record.payload.audience === "trusted_contact");
                assert.equal(trustedRecord.userId, "trusted-user-1");
                assert.equal(trustedRecord.payload.location.lat, 6.5244);
                assert.equal(db.auditRecords.length, 1);
                assert.equal(db.auditRecords[0].eventType, "notification_fanout_completed");
                assert.deepEqual(db.auditRecords[0].metadata, {
                    delivered: 3,
                    contacts: 1,
                    eventType: "alert_started",
                });
            }
            finally {
                await service.onModuleDestroy();
            }
        },
    );
});

test("processAlertContactNotifications audits no-contact fanout outcomes", async () => {
    await withEnv(
        {
            REDIS_URL: undefined,
        },
        async () => {
            const db = createNotificationDb({ contacts: [] });
            const service = new QueuesService(db, {});
            try {
                const result = await service.processAlertContactNotifications({
                    userId: "user-1",
                    alertId: "alert-1",
                    eventType: "alert_started",
                    stage: "high_alert",
                });

                assert.deepEqual(result, { ok: true, reason: "no_trusted_contacts", delivered: 0 });
                assert.equal(db.notificationRecords.length, 0);
                assert.equal(db.auditRecords.length, 1);
                assert.equal(db.auditRecords[0].metadata.reason, "no_trusted_contacts");
                assert.equal(db.auditRecords[0].metadata.contacts, 0);
            }
            finally {
                await service.onModuleDestroy();
            }
        },
    );
});
