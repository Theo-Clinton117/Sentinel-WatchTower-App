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
let QueuesService = class QueuesService {
    constructor() {
        this.escalationQueue = null;
        this.notificationQueue = null;
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
            return { ok: true, jobId: job.id };
        }, connection);
        new bullmq_1.Worker('notifications', async (job) => {
            return { ok: true, jobId: job.id };
        }, connection);
    }
    async scheduleEscalation(payload) {
        if (!this.escalationQueue) {
            return;
        }
        await this.escalationQueue.add('escalate', payload, {
            delay: 3 * 60 * 1000,
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
    __metadata("design:paramtypes", [])
], QueuesService);
//# sourceMappingURL=queues.service.js.map
