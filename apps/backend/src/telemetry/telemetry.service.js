"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
let TelemetryService = class TelemetryService {
    constructor(db) {
        this.db = db;
    }
    async ingest(userId, body) {
        const eventName = body?.eventName ?? body?.name;
        if (!eventName) {
            throw new common_1.BadRequestException('eventName is required');
        }
        const result = await this.db.query(`
      insert into telemetry_events (user_id, event_name, properties)
      values ($1, $2, $3)
      returning *
    `, [userId, eventName, body?.properties ?? body ?? {}]);
        const row = result.rows[0];
        return {
            accepted: true,
            id: row.id,
            userId: row.user_id,
            eventName: row.event_name,
            properties: row.properties,
            createdAt: row.created_at,
        };
    }
};
exports.TelemetryService = TelemetryService;
exports.TelemetryService = TelemetryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], TelemetryService);
//# sourceMappingURL=telemetry.service.js.map
