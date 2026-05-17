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
const db_service_1 = require("../db/db.service");
function configured(...values) {
    return values.every((value) => String(value || '').trim().length > 0);
}
let HealthService = class HealthService {
    constructor(db) {
        this.db = db;
    }
    async getHealth() {
        const checks = {
            database: { ok: false },
            redis: { ok: configured(process.env.REDIS_URL), configured: configured(process.env.REDIS_URL) },
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
        const required = [checks.database];
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
