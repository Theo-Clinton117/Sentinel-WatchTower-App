"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key, desc)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const db_service_1 = require("../db/db.service");
function configured(...values) {
    return values.every((value) => String(value || '').trim().length > 0);
}
async function checkRedisHealth() {
    const redisUrl = String(process.env.REDIS_URL || '').trim();
    if (!redisUrl) {
        return { ok: false, configured: false };
    }
    const Redis = ioredis_1.default || ioredis_1;
    const redis = new Redis(redisUrl, {
        connectTimeout: 1000,
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
    });
    try {
        await redis.connect();
        const pong = await redis.ping();
        return { ok: pong === 'PONG', configured: true };
    }
    catch (error) {
        return {
            ok: false,
            configured: true,
            error: error instanceof Error ? error.message : 'Redis check failed',
        };
    }
    finally {
        redis.disconnect();
    }
}
let HealthService = class HealthService {
    constructor(db, redisHealthCheck = checkRedisHealth) {
        this.db = db;
        this.redisHealthCheck = redisHealthCheck;
    }
    async getHealth() {
        const checks = {
            database: { ok: false },
            redis: { ok: false, configured: configured(process.env.REDIS_URL) },
            sms: {
                ok: configured(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, process.env.TWILIO_FROM_NUMBER),
                configured: configured(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, process.env.TWILIO_FROM_NUMBER),
            },
            phoneVerification: {
                ok: configured(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, process.env.TWILIO_VERIFY_SERVICE_SID),
                configured: configured(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, process.env.TWILIO_VERIFY_SERVICE_SID),
            },
            email: {
                ok: configured(process.env.RESEND_API_KEY, process.env.OTP_EMAIL_FROM),
                configured: configured(process.env.RESEND_API_KEY, process.env.OTP_EMAIL_FROM),
            },
            revenueCat: {
                ok: configured(process.env.REVENUECAT_PROJECT_ID, process.env.REVENUECAT_SECRET_API_KEY),
                configured: configured(process.env.REVENUECAT_PROJECT_ID, process.env.REVENUECAT_SECRET_API_KEY),
            },
        };
        try {
            await this.db.query('select 1 as ok');
            checks.database = { ok: true };
        }
        catch (error) {
            checks.database = {
                ok: false,
                error: error instanceof Error ? error.message : 'Database check failed',
            };
        }
        checks.redis = await this.redisHealthCheck();
        const required = [checks.database];
        if (checks.redis.configured) {
            required.push(checks.redis);
        }
        const status = required.every((check) => check.ok) ? 'ok' : 'degraded';
        return {
            status,
            timestamp: new Date().toISOString(),
            checks,
        };
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], HealthService);
