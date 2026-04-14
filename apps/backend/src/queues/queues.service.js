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
            return { ok: true, jobId: job.id };
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
            return;
        }
        await this.notificationQueue.add('notify', payload, { attempts: 3, backoff: { type: 'fixed', delay: 15000 } });
    }
};
exports.QueuesService = QueuesService;
exports.QueuesService = QueuesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService, ws_service_1.WsService])
], QueuesService);
//# sourceMappingURL=queues.service.js.map
