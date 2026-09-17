"use strict";

var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") {
        r = Reflect.decorate(decorators, target, key, desc);
    } else {
        for (var i = decorators.length - 1; i >= 0; i--) {
            if (d = decorators[i]) {
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
            }
        }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};

var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") {
        return Reflect.metadata(k, v);
    }
};

Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationsService = void 0;

const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const ws_service_1 = require("../ws/ws.service");

const LOCATION_COLUMNS =
    "id, session_id, user_id, lat, lng, accuracy_m, source, recorded_at";

function mapLocationRow(row) {
    return {
        id: row.id,
        sessionId: row.session_id,
        userId: row.user_id,
        lat: Number(row.lat),
        lng: Number(row.lng),
        accuracyM: row.accuracy_m == null ? null : Number(row.accuracy_m),
        source: row.source || "mobile",
        recordedAt: row.recorded_at,
    };
}

function normalizeLocationInput(item) {
    const coords = item?.coords || {};

    const lat = item?.lat ?? item?.latitude ?? coords.latitude;
    const lng = item?.lng ?? item?.longitude ?? coords.longitude;

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
        return null;
    }

    if (
        parsedLat < -90 ||
        parsedLat > 90 ||
        parsedLng < -180 ||
        parsedLng > 180
    ) {
        return null;
    }

    const rawRecordedAt =
        item?.recordedAt ??
        item?.timestamp ??
        null;

    const recordedAt =
        typeof rawRecordedAt === "number"
            ? new Date(rawRecordedAt).toISOString()
            : rawRecordedAt || new Date().toISOString();

    if (!Number.isFinite(Date.parse(recordedAt))) {
        return null;
    }

    const accuracy =
        item?.accuracyM ??
        item?.accuracy ??
        coords.accuracy ??
        null;

    const parsedAccuracy =
        accuracy == null ? null : Number(accuracy);

    return {
        lat: parsedLat,
        lng: parsedLng,
        accuracyM:
            Number.isFinite(parsedAccuracy) && parsedAccuracy >= 0
                ? parsedAccuracy
                : null,
        source: typeof item?.source === "string" && item.source.trim()
            ? item.source.trim().slice(0, 40)
            : "mobile",
        recordedAt: new Date(recordedAt).toISOString(),
    };
}

let LocationsService = class LocationsService {
    constructor(db, ws) {
        this.db = db;
        this.ws = ws;
    }

    async ingest(userId, sessionId, body) {
        if (!Array.isArray(body?.locations) || body.locations.length === 0) {
            throw new common_1.BadRequestException("No locations provided");
        }
        if (body.locations.length > 100) {
            throw new common_1.BadRequestException("A maximum of 100 locations can be submitted at once");
        }
        const normalized = body.locations.map(normalizeLocationInput).filter(Boolean);
        if (normalized.length === 0) {
            throw new common_1.BadRequestException("No valid locations provided");
        }
        const sessionResult = await this.db.query(
            "select id from watch_sessions where id = $1 and user_id = $2 limit 1",
            [sessionId, userId]
        );

        if (!sessionResult.rows[0]) {
            throw new common_1.NotFoundException("Session not found");
        }

        const inserted = await this.db.transaction(async (client) => {
            const values = [];

            const placeholders = normalized.map((location, index) => {
                const offset = index * 7;

                values.push(
                    sessionId,
                    userId,
                    location.lat,
                    location.lng,
                    location.accuracyM,
                    location.source,
                    location.recordedAt
                );

                return `(
                    $${offset + 1},
                    $${offset + 2},
                    $${offset + 3},
                    $${offset + 4},
                    $${offset + 5},
                    $${offset + 6},
                    $${offset + 7}
                )`;
            });

            const result = await client.query(
                `
                insert into location_logs (
                    session_id,
                    user_id,
                    lat,
                    lng,
                    accuracy_m,
                    source,
                    recorded_at
                )
                values ${placeholders.join(", ")}
                returning ${LOCATION_COLUMNS}
                `,
                values
            );

            return result.rows;
        });

        const payload = inserted.map(mapLocationRow);

        this.ws.emitSessionLocation(sessionId, payload);

        return {
            received: payload.length,
            locations: payload,
        };
    }

    async list(userId, sessionId) {
        const sessionResult = await this.db.query(
            `
            select id
            from watch_sessions
            where id = $1
              and user_id = $2
            limit 1
            `,
            [sessionId, userId]
        );

        if (!sessionResult.rows[0]) {
            throw new common_1.NotFoundException("Session not found");
        }

        const result = await this.db.query(
            `
            select ${LOCATION_COLUMNS}
            from location_logs
            where session_id = $1
              and user_id = $2
            order by recorded_at desc
            limit 100
            `,
            [sessionId, userId]
        );

        return {
            sessionId,
            locations: result.rows.map(mapLocationRow),
        };
    }
    // This is intentionally separate from session ownership. A Circle member
    // needs an active, non-expired grant to read another person's coordinates.
    async latestSharedLocation(requesterUserId, subjectUserId) {
        const grant = await this.db.query(`
            select id, purpose, expires_at
            from location_access_grants
            where subject_user_id = $1 and grantee_user_id = $2
              and status = 'active' and expires_at > now()
            order by expires_at desc limit 1
        `, [subjectUserId, requesterUserId]);
        const activeGrant = grant.rows[0];
        if (!activeGrant) {
            await this.db.query("insert into location_access_audit_events (subject_user_id, requester_user_id, action, outcome, reason) values ($1, $2, 'read_latest_location', 'denied', 'no_active_grant')", [subjectUserId, requesterUserId]);
            throw new common_1.ForbiddenException("This person has not shared their location with you.");
        }
        const location = await this.db.query(`
            select id, session_id, user_id, lat, lng, accuracy_m, source, recorded_at
            from location_logs where user_id = $1 order by recorded_at desc limit 1
        `, [subjectUserId]);
        await this.db.query("insert into location_access_audit_events (subject_user_id, requester_user_id, grant_id, action, outcome, reason) values ($1, $2, $3, 'read_latest_location', 'allowed', $4)", [subjectUserId, requesterUserId, activeGrant.id, activeGrant.purpose]);
        const row = location.rows[0];
        if (!row) return { status: 'unavailable', location: null };
        const mapped = mapLocationRow(row);
        const ageMs = Date.now() - new Date(mapped.recordedAt).getTime();
        return {
            status: ageMs <= 10 * 60 * 1000 ? 'current' : 'last_confirmed',
            location: mapped,
            grantExpiresAt: activeGrant.expires_at,
        };
    }
};

exports.LocationsService = LocationsService;

exports.LocationsService = LocationsService = __decorate(
    [
        (0, common_1.Injectable)(),
        __metadata(
            "design:paramtypes",
            [db_service_1.DbService, ws_service_1.WsService]
        )
    ],
    LocationsService
);
