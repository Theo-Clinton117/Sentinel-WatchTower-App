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
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map
