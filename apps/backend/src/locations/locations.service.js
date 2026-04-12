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
exports.LocationsService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const ws_service_1 = require("../ws/ws.service");
function mapLocationRow(row) {
    return {
        id: row.id,
        sessionId: row.session_id,
        userId: row.user_id,
        lat: Number(row.lat),
        lng: Number(row.lng),
        accuracyM: row.accuracy_m,
        source: row.source,
        recordedAt: row.recorded_at,
        createdAt: row.created_at,
    };
}
function normalizeLocationInput(item) {
    const coords = item?.coords || {};
    const lat = item?.lat ?? item?.latitude ?? coords.latitude;
    const lng = item?.lng ?? item?.longitude ?? coords.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        return null;
    }
    const rawRecordedAt = item?.recordedAt ?? item?.timestamp ?? null;
    const recordedAt = typeof rawRecordedAt === 'number'
        ? new Date(rawRecordedAt).toISOString()
        : rawRecordedAt || new Date().toISOString();
    return {
        lat,
        lng,
        accuracyM: item?.accuracyM ?? item?.accuracy ?? coords.accuracy ?? null,
        source: item?.source ?? 'mobile',
        recordedAt,
    };
}
let LocationsService = class LocationsService {
    constructor(db, ws) {
        this.db = db;
        this.ws = ws;
    }
    async ingest(userId, sessionId, body) {
        const sessionResult = await this.db.query('select id from watch_sessions where id = $1 and user_id = $2 limit 1', [sessionId, userId]);
        if (!sessionResult.rows[0]) {
            throw new common_1.NotFoundException('Session not found');
        }
        if (!Array.isArray(body?.locations) || body.locations.length === 0) {
            throw new common_1.BadRequestException('No locations provided');
        }
        const normalized = body.locations.map(normalizeLocationInput).filter(Boolean);
        if (normalized.length === 0) {
            throw new common_1.BadRequestException('No valid locations provided');
        }
        const inserted = await this.db.transaction(async (client) => {
            const rows = [];
            for (const location of normalized) {
                const result = await client.query(`
            insert into location_logs (
              session_id, user_id, lat, lng, accuracy_m, source, recorded_at
            )
            values ($1, $2, $3, $4, $5, $6, $7)
            returning *
          `, [
                    sessionId,
                    userId,
                    location.lat,
                    location.lng,
                    location.accuracyM,
                    location.source,
                    location.recordedAt,
                ]);
                rows.push(result.rows[0]);
            }
            await client.query('update watch_sessions set last_location_at = now() where id = $1 and user_id = $2', [sessionId, userId]);
            return rows;
        });
        const payload = inserted.map(mapLocationRow);
        this.ws.emitSessionLocation(sessionId, payload);
        return { received: payload.length, locations: payload };
    }
    async list(userId, sessionId) {
        const sessionResult = await this.db.query('select id from watch_sessions where id = $1 and user_id = $2 limit 1', [sessionId, userId]);
        if (!sessionResult.rows[0]) {
            throw new common_1.NotFoundException('Session not found');
        }
        const result = await this.db.query(`
      select *
      from location_logs
      where session_id = $1 and user_id = $2
      order by recorded_at desc
      limit 100
    `, [sessionId, userId]);
        return { sessionId, locations: result.rows.map(mapLocationRow) };
    }
};
exports.LocationsService = LocationsService;
exports.LocationsService = LocationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService, ws_service_1.WsService])
], LocationsService);
//# sourceMappingURL=locations.service.js.map
