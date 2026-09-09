"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const pagination_1 = require("../common/pagination");
let NotificationsService = class NotificationsService {
    constructor(db) {
        this.db = db;
    }
    async list(userId, options = {}) {
        const { limit, offset } = (0, pagination_1.getPagination)(options);
        const result = await this.db.query(`
      select id, user_id, type, channel, status, payload, related_session_id, created_at, sent_at
      from notifications
      where user_id = $1
      order by created_at desc
      limit $2 offset $3
    `, [userId, limit, offset]);
        return result.rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            type: row.type,
            channel: row.channel,
            status: row.status,
            payload: row.payload,
            relatedSessionId: row.related_session_id,
            createdAt: row.created_at,
            sentAt: row.sent_at,
        }));
    }
    async listAlertAudit(userId, options = {}) {
        const { limit, offset } = (0, pagination_1.getPagination)(options);
        const result = await this.db.query(`
      select id, alert_id, session_id, user_id, event_type, source, from_stage, to_stage, metadata, created_at
      from alert_audit_events
      where user_id = $1
      order by created_at desc
      limit $2 offset $3
    `, [userId, limit, offset]);
        return result.rows.map((row) => ({
            id: row.id,
            alertId: row.alert_id,
            sessionId: row.session_id,
            userId: row.user_id,
            eventType: row.event_type,
            source: row.source,
            fromStage: row.from_stage,
            toStage: row.to_stage,
            metadata: row.metadata || {},
            createdAt: row.created_at,
        }));
    }
    async registerPushToken(userId, body) {
        const deviceId = String(body?.deviceId || '').trim();
        const token = String(body?.token || '').trim();
        const platform = String(body?.platform || '').trim() || null;
        if (!deviceId || !/^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/.test(token)) {
            throw new common_1.BadRequestException('A valid device and Expo push token are required.');
        }
        const existing = await this.db.query(`
          select id from user_devices
          where user_id = $1 and device_id = $2
          order by created_at desc limit 1
        `, [userId, deviceId]);
        if (existing.rows[0]) {
            await this.db.query('update user_devices set fcm_token = $2, platform = $3, last_seen_at = now() where id = $1', [existing.rows[0].id, token, platform]);
        }
        else {
            await this.db.query('insert into user_devices (user_id, device_id, fcm_token, platform, last_seen_at) values ($1, $2, $3, $4, now())', [userId, deviceId, token, platform]);
        }
        // A token may move to another account after an explicit sign-in.
        await this.db.query('update user_devices set fcm_token = null where user_id <> $1 and fcm_token = $2', [userId, token]);
        return { status: 'ready' };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map
