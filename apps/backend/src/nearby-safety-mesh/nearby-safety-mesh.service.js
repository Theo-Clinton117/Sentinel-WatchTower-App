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
exports.NearbySafetyMeshService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const MOTION_STATES = new Set(['stationary', 'walking', 'running', 'driving', 'unknown']);
const PROXIMITY_BANDS = new Set(['near', 'medium', 'far']);
const AREA_CELL_PATTERN = /^-?\d{1,3}\.\d{3}:-?\d{1,3}\.\d{3}$/;
const EXPIRED_SIGNAL_CLEANUP_INTERVAL_MS = 60000;
function clampConfidence(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.max(0, Math.min(1, numeric));
}
function normalizeSignal(body) {
    const areaCell = String(body?.areaCell || '').trim();
    const signal = body?.signal || {};
    const ephemeralDeviceId = String(signal.ephemeralDeviceId || '').trim().slice(0, 96);
    const motionState = MOTION_STATES.has(signal.motionState) ? signal.motionState : 'unknown';
    const proximityBand = PROXIMITY_BANDS.has(signal.proximityBand) ? signal.proximityBand : 'medium';
    const observedAt = Number.isFinite(Number(signal.timestamp))
        ? new Date(Number(signal.timestamp)).toISOString()
        : new Date().toISOString();
    if (!AREA_CELL_PATTERN.test(areaCell)) {
        throw new common_1.BadRequestException('Valid areaCell is required');
    }
    if (!ephemeralDeviceId || ephemeralDeviceId.length < 12) {
        throw new common_1.BadRequestException('Valid ephemeralDeviceId is required');
    }
    return {
        areaCell,
        ephemeralDeviceId,
        proximityBand,
        motionState,
        confidence: clampConfidence(signal.confidence),
        observedAt,
    };
}
function mapSignalRow(row) {
    return {
        ephemeralDeviceId: row.ephemeral_device_id,
        timestamp: new Date(row.observed_at).getTime(),
        proximityBand: row.proximity_band,
        motionState: row.motion_state,
        confidence: Number(row.confidence),
    };
}
let NearbySafetyMeshService = class NearbySafetyMeshService {
    constructor(db) {
        this.db = db;
        this.lastExpiredSignalCleanupAtMs = 0;
    }
    async cleanupExpiredSignalsIfDue() {
        const nowMs = Date.now();
        if (nowMs - this.lastExpiredSignalCleanupAtMs < EXPIRED_SIGNAL_CLEANUP_INTERVAL_MS) {
            return;
        }
        this.lastExpiredSignalCleanupAtMs = nowMs;
        await this.db.query(`
      delete from nearby_safety_mesh_signals
      where expires_at < now()
    `);
    }
    async publish(userId, body) {
        const signal = normalizeSignal(body);
        await this.cleanupExpiredSignalsIfDue();
        await this.db.query(`
      insert into nearby_safety_mesh_signals (
        user_id,
        area_cell,
        ephemeral_device_id,
        proximity_band,
        motion_state,
        confidence,
        observed_at,
        expires_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, now() + interval '2 minutes', now())
      on conflict (user_id, ephemeral_device_id)
      do update set
        area_cell = excluded.area_cell,
        proximity_band = excluded.proximity_band,
        motion_state = excluded.motion_state,
        confidence = excluded.confidence,
        observed_at = excluded.observed_at,
        expires_at = excluded.expires_at,
        updated_at = now()
    `, [
            userId,
            signal.areaCell,
            signal.ephemeralDeviceId,
            signal.proximityBand,
            signal.motionState,
            signal.confidence,
            signal.observedAt,
        ]);
        const nearby = await this.list(userId, signal.areaCell);
        return {
            areaCell: signal.areaCell,
            received: true,
            signals: nearby.signals,
        };
    }
    async list(userId, areaCell) {
        const normalizedAreaCell = String(areaCell || '').trim();
        if (!AREA_CELL_PATTERN.test(normalizedAreaCell)) {
            throw new common_1.BadRequestException('Valid areaCell is required');
        }
        const result = await this.db.query(`
      select ephemeral_device_id, proximity_band, motion_state, confidence, observed_at
      from nearby_safety_mesh_signals
      where area_cell = $1
        and user_id <> $2
        and expires_at > now()
      order by observed_at desc
      limit 30
    `, [normalizedAreaCell, userId]);
        return {
            areaCell: normalizedAreaCell,
            signals: result.rows.map(mapSignalRow),
        };
    }
};
exports.NearbySafetyMeshService = NearbySafetyMeshService;
exports.NearbySafetyMeshService = NearbySafetyMeshService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], NearbySafetyMeshService);
//# sourceMappingURL=nearby-safety-mesh.service.js.map
