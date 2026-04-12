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
let NotificationsService = class NotificationsService {
    constructor(db) {
        this.db = db;
    }
    async list(userId) {
        const result = await this.db.query(`
      select *
      from notifications
      where user_id = $1
      order by created_at desc
      limit 100
    `, [userId]);
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
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map
