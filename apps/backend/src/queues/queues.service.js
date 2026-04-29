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
exports.QueuesService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const db_service_1 = require("../db/db.service");
const ws_service_1 = require("../ws/ws.service");
const alert_stages_1 = require("../alerts/alert-stages");
function hasValue(value) {
    return value !== null && value !== undefined && String(value).trim().length > 0;
}
function toStageLabel(value) {
    return String(value || 'alert')
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'Alert';
}
function toDisplayName(user, fallback = 'Sentinel member') {
    return String(user?.name || user?.email || user?.phone_e164 || fallback);
}
function buildMapLink(location) {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        return null;
    }
    return `https://maps.google.com/?q=${location.lat},${location.lng}`;
}
let QueuesService = class QueuesService {
    constructor(db, ws) {
        this.escalationQueue = null;
        this.notificationQueue = null;
        this.db = db;
        this.ws = ws;
        if (!process.env.REDIS_URL) {
            common_1.Logger.warn('REDIS_URL is not set. Queue workers are disabled.', 'QueuesService');
            return;
        }
        const connection = {
            connection: {
                url: process.env.REDIS_URL,
            },
        };
        this.escalationQueue = new bullmq_1.Queue('escalation', connection);
        this.notificationQueue = new bullmq_1.Queue('notifications', connection);
        new bullmq_1.Worker('escalation', async (job) => {
            return this.processEscalationJob(job);
        }, connection);
        new bullmq_1.Worker('notifications', async (job) => {
            return this.processNotificationJob(job);
        }, connection);
    }
    async processEscalationJob(job) {
        const targetStage = (0, alert_stages_1.normalizeAlertStage)(job.data?.targetStage);
        if (!job.data?.alertId || !job.data?.sessionId) {
            return { ok: false, reason: 'missing_payload' };
        }
        const result = await this.db.query(`
      select
        a.id as alert_id,
        a.status as alert_status,
        a.stage,
        s.id as session_id
      from alerts a
      left join watch_sessions s on s.alert_id = a.id and s.status = 'active'
      where a.id = $1
      limit 1
    `, [job.data.alertId]);
        const alert = result.rows[0];
        if (!alert || alert.alert_status !== 'active' || !alert.session_id) {
            return { ok: true, reason: 'alert_not_active' };
        }
        const currentStage = (0, alert_stages_1.normalizeAlertStage)(alert.stage);
        if ((0, alert_stages_1.compareAlertStages)(currentStage, targetStage) >= 0) {
            return { ok: true, reason: 'stage_already_reached', stage: currentStage };
        }
        const escalationLevel = (0, alert_stages_1.getEscalationLevel)(targetStage);
        await this.db.transaction(async (client) => {
            await client.query(`
          update alerts
          set
            stage = $1,
            escalation_level = $2,
            cancel_expires_at = null,
            escalated_at = now()
          where id = $3 and status = 'active'
        `, [targetStage, escalationLevel, alert.alert_id]);
            await client.query(`
          update watch_sessions
          set escalation_level = $1
          where alert_id = $2 and status = 'active'
        `, [escalationLevel, alert.alert_id]);
        });
        this.ws.emitSessionStatus(alert.session_id, 'active', targetStage);
        await this.scheduleEscalation({
            alertId: alert.alert_id,
            sessionId: alert.session_id,
            stage: targetStage,
        });
        return {
            ok: true,
            stage: targetStage,
            jobId: job.id,
        };
    }
    async scheduleEscalation(payload) {
        if (!this.escalationQueue) {
            return;
        }
        const currentStage = (0, alert_stages_1.normalizeAlertStage)(payload?.stage);
        const plan = (0, alert_stages_1.getNextEscalationPlan)(currentStage);
        await this.cancelEscalation(payload.alertId);
        if (!plan) {
            return;
        }
        await this.escalationQueue.add('escalate', {
            ...payload,
            targetStage: plan.targetStage,
        }, {
            delay: plan.delayMs,
            jobId: `alert-${payload.alertId}`,
        });
    }
    async cancelEscalation(alertId) {
        if (!this.escalationQueue) {
            return;
        }
        const job = await this.escalationQueue.getJob(`alert-${alertId}`);
        if (job) {
            await job.remove();
        }
    }
    async enqueueNotification(payload) {
        if (!this.notificationQueue) {
            return this.processNotificationJob({
                id: `inline-${Date.now()}`,
                data: payload,
            });
        }
        await this.notificationQueue.add('notify', payload, { attempts: 3, backoff: { type: 'fixed', delay: 15000 } });
    }
    async enqueueAlertNotifications(payload) {
        if (!payload?.userId || !payload?.alertId) {
            return { ok: false, reason: 'missing_alert_notification_payload' };
        }
        return this.enqueueNotification({
            type: 'alert_contact_fanout',
            ...payload,
        });
    }
    async processNotificationJob(job) {
        if (job?.data?.type === 'alert_contact_fanout') {
            return this.processAlertContactNotifications(job.data);
        }
        return { ok: false, reason: 'unknown_notification_type', jobId: job?.id ?? null };
    }
    async processAlertContactNotifications(payload) {
        const alertResult = await this.db.query(`
      select
        a.id as alert_id,
        a.user_id,
        a.status as alert_status,
        a.trigger_source,
        a.stage,
        a.risk_score,
        a.cancel_expires_at,
        a.created_at,
        s.id as session_id,
        u.name as owner_name,
        u.email as owner_email,
        u.phone_e164 as owner_phone
      from alerts a
      join users u on u.id = a.user_id
      left join watch_sessions s on s.alert_id = a.id
      where a.id = $1 and a.user_id = $2
      order by s.started_at desc nulls last
      limit 1
    `, [payload.alertId, payload.userId]);
        const alert = alertResult.rows[0];
        if (!alert) {
            return { ok: false, reason: 'alert_not_found' };
        }
        const contactsResult = await this.db.query(`
      select
        tc.*,
        utp.can_view_location,
        utp.can_view_history,
        utp.can_sms,
        utp.can_call,
        linked_user.name as linked_name,
        linked_user.email as linked_email,
        linked_user.phone_e164 as linked_phone
      from trusted_contacts tc
      left join user_trust_profiles utp
        on utp.contact_id = tc.id and utp.user_id = tc.user_id
      left join users linked_user
        on linked_user.id = tc.contact_user_id
      where tc.user_id = $1
      order by tc.priority asc, tc.created_at asc
    `, [payload.userId]);
        const contacts = contactsResult.rows;
        if (contacts.length === 0) {
            return { ok: true, reason: 'no_trusted_contacts', delivered: 0 };
        }
        let latestLocation = null;
        if (alert.session_id) {
            const locationResult = await this.db.query(`
        select lat, lng, accuracy_m, recorded_at
        from location_logs
        where session_id = $1
        order by recorded_at desc
        limit 1
      `, [alert.session_id]);
            latestLocation = locationResult.rows[0] || null;
        }
        const summaryItems = Array.isArray(payload.detectionSummary)
            ? payload.detectionSummary.filter((item) => typeof item === 'string' && item.trim()).slice(0, 2)
            : [];
        const owner = {
            id: alert.user_id,
            name: alert.owner_name,
            email: alert.owner_email,
            phone_e164: alert.owner_phone,
        };
        let delivered = 0;
        for (const contact of contacts) {
            const recipientName = String(contact.contact_name || contact.linked_name || contact.contact_email || contact.contact_phone || 'Trusted contact');
            const recipientEmail = contact.contact_email || contact.linked_email || null;
            const recipientPhone = contact.contact_phone || contact.linked_phone || null;
            const locationAllowed = (contact.can_view_location ?? true) && latestLocation;
            const messageBundle = this.buildAlertNotificationMessage({
                eventType: payload.eventType,
                triggerSource: alert.trigger_source,
                stage: payload.stage || alert.stage,
                owner,
                recipientName,
                location: locationAllowed ? latestLocation : null,
                summaryItems,
            });
            if (contact.contact_user_id) {
                await this.createNotificationRecord({
                    userId: payload.userId,
                    type: payload.eventType || 'alert_contact_update',
                    channel: 'in_app',
                    status: 'sent',
                    relatedSessionId: alert.session_id || null,
                    payload: {
                        audience: 'owner_audit',
                        recipientUserId: contact.contact_user_id,
                        recipientName,
                        alertId: alert.alert_id,
                        stage: payload.stage || alert.stage,
                        message: messageBundle.inApp,
                    },
                });
                await this.createNotificationRecord({
                    userId: contact.contact_user_id,
                    type: payload.eventType || 'alert_contact_update',
                    channel: 'in_app',
                    status: 'sent',
                    relatedSessionId: alert.session_id || null,
                    payload: {
                        audience: 'trusted_contact',
                        actorUserId: payload.userId,
                        actorName: toDisplayName(owner),
                        alertId: alert.alert_id,
                        triggerSource: alert.trigger_source,
                        stage: payload.stage || alert.stage,
                        riskScore: alert.risk_score,
                        message: messageBundle.inApp,
                        location: locationAllowed ? {
                            lat: latestLocation.lat,
                            lng: latestLocation.lng,
                            accuracyM: latestLocation.accuracy_m ?? null,
                            recordedAt: latestLocation.recorded_at ?? null,
                        } : null,
                    },
                });
                delivered += 1;
            }
            if (recipientPhone && (contact.can_sms ?? true)) {
                if (this.isSmsConfigured()) {
                    try {
                        await this.sendSms(recipientPhone, messageBundle.sms);
                        delivered += 1;
                        await this.createNotificationRecord({
                            userId: payload.userId,
                            type: payload.eventType || 'alert_contact_update',
                            channel: 'sms',
                            status: 'sent',
                            relatedSessionId: alert.session_id || null,
                            payload: {
                                recipientName,
                                recipientPhone,
                                alertId: alert.alert_id,
                                stage: payload.stage || alert.stage,
                                message: messageBundle.sms,
                            },
                        });
                    }
                    catch (error) {
                        await this.createNotificationRecord({
                            userId: payload.userId,
                            type: payload.eventType || 'alert_contact_update',
                            channel: 'sms',
                            status: 'failed',
                            relatedSessionId: alert.session_id || null,
                            payload: {
                                recipientName,
                                recipientPhone,
                                alertId: alert.alert_id,
                                stage: payload.stage || alert.stage,
                                error: error instanceof Error ? error.message : 'SMS delivery failed.',
                            },
                        });
                    }
                }
                else {
                    await this.createNotificationRecord({
                        userId: payload.userId,
                        type: payload.eventType || 'alert_contact_update',
                        channel: 'sms',
                        status: 'skipped',
                        relatedSessionId: alert.session_id || null,
                        payload: {
                            recipientName,
                            recipientPhone,
                            alertId: alert.alert_id,
                            stage: payload.stage || alert.stage,
                            reason: 'twilio_not_configured',
                        },
                    });
                }
            }
            if (recipientEmail) {
                if (this.isEmailConfigured()) {
                    try {
                        await this.sendEmail({
                            to: recipientEmail,
                            subject: messageBundle.emailSubject,
                            text: messageBundle.emailText,
                            html: messageBundle.emailHtml,
                        });
                        delivered += 1;
                        await this.createNotificationRecord({
                            userId: payload.userId,
                            type: payload.eventType || 'alert_contact_update',
                            channel: 'email',
                            status: 'sent',
                            relatedSessionId: alert.session_id || null,
                            payload: {
                                recipientName,
                                recipientEmail,
                                alertId: alert.alert_id,
                                stage: payload.stage || alert.stage,
                                subject: messageBundle.emailSubject,
                            },
                        });
                    }
                    catch (error) {
                        await this.createNotificationRecord({
                            userId: payload.userId,
                            type: payload.eventType || 'alert_contact_update',
                            channel: 'email',
                            status: 'failed',
                            relatedSessionId: alert.session_id || null,
                            payload: {
                                recipientName,
                                recipientEmail,
                                alertId: alert.alert_id,
                                stage: payload.stage || alert.stage,
                                error: error instanceof Error ? error.message : 'Email delivery failed.',
                            },
                        });
                    }
                }
                else {
                    await this.createNotificationRecord({
                        userId: payload.userId,
                        type: payload.eventType || 'alert_contact_update',
                        channel: 'email',
                        status: 'skipped',
                        relatedSessionId: alert.session_id || null,
                        payload: {
                            recipientName,
                            recipientEmail,
                            alertId: alert.alert_id,
                            stage: payload.stage || alert.stage,
                            reason: 'resend_not_configured',
                        },
                    });
                }
            }
        }
        return { ok: true, delivered, contacts: contacts.length };
    }
    buildAlertNotificationMessage({ eventType, triggerSource, stage, owner, recipientName, location, summaryItems, }) {
        const stageLabel = toStageLabel(stage);
        const ownerLabel = toDisplayName(owner);
        const mapLink = buildMapLink(location);
        const locationLine = mapLink
            ? `Last known location: ${location.lat}, ${location.lng}${hasValue(location.accuracy_m) ? ` (accuracy ${Math.round(Number(location.accuracy_m))}m)` : ''}. ${mapLink}`
            : null;
        const summaryLine = summaryItems.length > 0 ? `Context: ${summaryItems.join(' ')}` : null;
        if (eventType === 'alert_cancelled') {
            const sms = `Sentinel: ${ownerLabel} has marked their alert as safe. No further action is needed right now.`;
            return {
                sms,
                inApp: `${ownerLabel} marked their Sentinel alert as safe.`,
                emailSubject: `${ownerLabel} is safe now`,
                emailText: [
                    `Hello ${recipientName},`,
                    '',
                    `${ownerLabel} has cancelled their Sentinel alert and marked themselves safe.`,
                    '',
                    'No further action is needed right now.',
                ].join('\n'),
                emailHtml: `<p>Hello ${recipientName},</p><p><strong>${ownerLabel}</strong> has cancelled their Sentinel alert and marked themselves safe.</p><p>No further action is needed right now.</p>`,
            };
        }
        const intro = eventType === 'alert_escalated'
            ? `${ownerLabel}'s Sentinel alert has escalated to ${stageLabel}.`
            : `${ownerLabel} triggered a Sentinel ${stageLabel}.`;
        const smsParts = [
            `Sentinel: ${intro}`,
            summaryLine,
            locationLine,
        ].filter(Boolean);
        return {
            sms: smsParts.join(' '),
            inApp: intro,
            emailSubject: eventType === 'alert_escalated'
                ? `${ownerLabel}'s alert escalated to ${stageLabel}`
                : `${ownerLabel} triggered a ${stageLabel}`,
            emailText: [
                `Hello ${recipientName},`,
                '',
                intro,
                triggerSource ? `Trigger: ${String(triggerSource).replace('_', ' ')}.` : null,
                summaryLine,
                locationLine,
                '',
                'Please check in through your usual safety process as soon as you can.',
            ].filter(Boolean).join('\n'),
            emailHtml: [
                `<p>Hello ${recipientName},</p>`,
                `<p><strong>${intro}</strong></p>`,
                triggerSource ? `<p>Trigger: ${String(triggerSource).replace('_', ' ')}</p>` : '',
                summaryLine ? `<p>${summaryLine}</p>` : '',
                locationLine ? `<p>${locationLine}</p>` : '',
                '<p>Please check in through your usual safety process as soon as you can.</p>',
            ].join(''),
        };
    }
    async createNotificationRecord({ userId, type, channel, status, payload, relatedSessionId, }) {
        if (!userId) {
            return null;
        }
        const result = await this.db.query(`
      insert into notifications (
        user_id,
        type,
        channel,
        status,
        payload,
        related_session_id,
        sent_at
      )
      values ($1, $2, $3, $4, $5::jsonb, $6, case when $4 in ('sent', 'delivered') then now() else null end)
      returning id
    `, [
            userId,
            type || 'alert_contact_update',
            channel || 'in_app',
            status || 'queued',
            JSON.stringify(payload || {}),
            relatedSessionId || null,
        ]);
        return result.rows[0]?.id || null;
    }
    isSmsConfigured() {
        return Boolean(process.env.TWILIO_ACCOUNT_SID &&
            process.env.TWILIO_AUTH_TOKEN &&
            process.env.TWILIO_FROM_NUMBER);
    }
    isEmailConfigured() {
        return Boolean(process.env.RESEND_API_KEY && process.env.OTP_EMAIL_FROM);
    }
    async sendSms(to, body) {
        const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
        const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
        const from = String(process.env.TWILIO_FROM_NUMBER || '').trim();
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                To: to,
                From: from,
                Body: body,
            }).toString(),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Could not send SMS. ${errorBody || response.statusText}`);
        }
    }
    async sendEmail({ to, subject, text, html }) {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: process.env.OTP_EMAIL_FROM,
                to: [to],
                subject,
                text,
                html,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Could not send email. ${errorBody || response.statusText}`);
        }
    }
};
exports.QueuesService = QueuesService;
exports.QueuesService = QueuesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService, ws_service_1.WsService])
], QueuesService);
//# sourceMappingURL=queues.service.js.map
