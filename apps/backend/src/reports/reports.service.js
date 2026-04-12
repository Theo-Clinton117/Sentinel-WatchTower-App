"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
        return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const credibility_logic_1 = require("../credibility/credibility.logic");
function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function mapReportRow(row) {
    const hasLocation = row.lat != null && row.lng != null;
    return {
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        title: row.title,
        description: row.description,
        status: row.status,
        category: row.category || null,
        severity: row.severity || 'medium',
        createdAt: row.created_at,
        flagsCount: toNumber(row.flags_count, 0),
        confirmationsCount: toNumber(row.confirmations_count, 0),
        confirmedByMe: Boolean(row.confirmed_by_me),
        media: Array.isArray(row.media) ? row.media : [],
        location: hasLocation
            ? {
                lat: Number(row.lat),
                lng: Number(row.lng),
                accuracyM: row.location_accuracy_m == null ? null : Number(row.location_accuracy_m),
            }
            : null,
        distribution: {
            status: row.distribution_status || 'queued',
            reason: row.distribution_reason || null,
            visibilityScope: row.visibility_scope || 'nearby_only',
            requiresManualReview: Boolean(row.requires_manual_review),
            throttledUntil: row.throttled_until || null,
            restrictionApplied: row.restriction_applied || 'none',
        },
        classification: {
            status: row.classification || 'inconclusive',
            responseOutcome: row.response_outcome || 'pending',
            aiConfidence: toNumber(row.ai_confidence, 0),
            qualityScore: toNumber(row.quality_score, 0),
            credibilitySnapshot: toNumber(row.credibility_snapshot, 0),
            corroborationCount: toNumber(row.corroboration_count, 0),
            reviewedAt: row.reviewed_at || null,
            reviewedBy: row.reviewed_by || null,
            notes: row.notes || null,
        },
    };
}
function validateCoordinates(body) {
    const hasLat = body?.lat !== undefined && body?.lat !== null;
    const hasLng = body?.lng !== undefined && body?.lng !== null;
    if (hasLat !== hasLng) {
        throw new common_1.BadRequestException('lat and lng must be provided together');
    }
    if (!hasLat && !hasLng) {
        return;
    }
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw new common_1.BadRequestException('lat must be between -90 and 90');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw new common_1.BadRequestException('lng must be between -180 and 180');
    }
}
let ReportsService = class ReportsService {
    constructor(db) {
        this.db = db;
    }
    async list(userId) {
        const result = await this.db.query(`
      select
        r.*,
        coalesce((
          select json_agg(
            json_build_object(
              'id', rm.id,
              'url', rm.url,
              'mimeType', rm.mime_type,
              'createdAt', rm.created_at
            )
            order by rm.created_at asc
          )
          from report_media rm
          where rm.report_id = r.id
        ), '[]'::json) as media,
        (select count(*)::int from report_flags rf where rf.report_id = r.id) as flags_count,
        (select count(*)::int from report_confirmations rc2 where rc2.report_id = r.id) as confirmations_count,
        exists(select 1 from report_confirmations rc2 where rc2.report_id = r.id and rc2.user_id = $1) as confirmed_by_me,
        rc.classification,
        rc.response_outcome,
        rc.ai_confidence,
        rc.quality_score,
        rc.credibility_snapshot,
        rc.corroboration_count,
        rc.reviewed_at,
        rc.reviewed_by,
        rc.notes
      from reports r
      left join report_classifications rc on rc.report_id = r.id
      where r.user_id = $1
      order by r.created_at desc
    `, [userId]);
        return result.rows.map(mapReportRow);
    }
    async getById(userId, id) {
        const result = await this.db.query(`
      select
        r.*,
        coalesce((
          select json_agg(
            json_build_object(
              'id', rm.id,
              'url', rm.url,
              'mimeType', rm.mime_type,
              'createdAt', rm.created_at
            )
            order by rm.created_at asc
          )
          from report_media rm
          where rm.report_id = r.id
        ), '[]'::json) as media,
        (select count(*)::int from report_flags rf where rf.report_id = r.id) as flags_count,
        (select count(*)::int from report_confirmations rc2 where rc2.report_id = r.id) as confirmations_count,
        exists(select 1 from report_confirmations rc2 where rc2.report_id = r.id and rc2.user_id = $1) as confirmed_by_me,
        rc.classification,
        rc.response_outcome,
        rc.ai_confidence,
        rc.quality_score,
        rc.credibility_snapshot,
        rc.corroboration_count,
        rc.reviewed_at,
        rc.reviewed_by,
        rc.notes
      from reports r
      left join report_classifications rc on rc.report_id = r.id
      where r.id = $2 and r.user_id = $1
      limit 1
    `, [userId, id]);
        const row = result.rows[0];
        if (!row) {
            throw new common_1.NotFoundException('Report not found');
        }
        return mapReportRow(row);
    }
    async create(userId, body) {
        if (!body?.title) {
            throw new common_1.BadRequestException('title is required');
        }
        validateCoordinates(body);
        if (body?.severity === 'critical' && body?.confirmedSeverity !== true) {
            throw new common_1.BadRequestException('Critical reports require confirmedSeverity=true before they can be distributed');
        }
        const severity = ['low', 'medium', 'high', 'critical'].includes(String(body?.severity || '').toLowerCase())
            ? String(body.severity).toLowerCase()
            : 'medium';
        const category = body?.category ? String(body.category).trim().toLowerCase() : null;
        return this.db.transaction(async (client) => {
            const reporterProfile = await (0, credibility_logic_1.ensureCredibilityProfile)(client, userId);
            if (reporterProfile.restrictionLevel === 'ban') {
                throw new common_1.ForbiddenException('Your account can no longer submit reports');
            }
            const reportResult = await client.query(`
        insert into reports (
          user_id,
          session_id,
          title,
          description,
          status,
          category,
          severity,
          lat,
          lng,
          location_accuracy_m
        )
        values ($1, $2, $3, $4, 'open', $5, $6, $7, $8, $9)
        returning *
      `, [
                userId,
                body?.sessionId ?? null,
                String(body.title).trim(),
                body?.description ? String(body.description).trim() : null,
                category,
                severity,
                body?.lat ?? null,
                body?.lng ?? null,
                body?.locationAccuracyM ?? null,
            ]);
            const report = reportResult.rows[0];
            report.ai_confidence = body?.aiConfidence ?? null;
            const mediaItems = Array.isArray(body?.media) ? body.media : [];
            const media = [];
            for (const item of mediaItems) {
                if (!item?.url) {
                    continue;
                }
                const mediaResult = await client.query(`
          insert into report_media (report_id, url, mime_type)
          values ($1, $2, $3)
          returning id, url, mime_type, created_at
        `, [report.id, item.url, item?.mimeType ?? null]);
                const row = mediaResult.rows[0];
                media.push({
                    id: row.id,
                    url: row.url,
                    mimeType: row.mime_type,
                    createdAt: row.created_at,
                });
            }
            await (0, credibility_logic_1.evaluateReportOnCreate)(client, userId, report, media);
            await (0, credibility_logic_1.refreshCredibilityProfile)(client, userId);
            const hydrated = await client.query(`
        select
          r.*,
          $2::json as media,
          0 as flags_count,
          0 as confirmations_count,
          false as confirmed_by_me,
          rc.classification,
          rc.response_outcome,
          rc.ai_confidence,
          rc.quality_score,
          rc.credibility_snapshot,
          rc.corroboration_count,
          rc.reviewed_at,
          rc.reviewed_by,
          rc.notes
        from reports r
        left join report_classifications rc on rc.report_id = r.id
        where r.id = $1
        limit 1
      `, [report.id, JSON.stringify(media)]);
            return mapReportRow(hydrated.rows[0]);
        });
    }
    async flag(userId, id, body) {
        return this.db.transaction(async (client) => {
            const reportResult = await client.query('select id, user_id from reports where id = $1 limit 1', [id]);
            const report = reportResult.rows[0];
            if (!report) {
                throw new common_1.NotFoundException('Report not found');
            }
            if (report.user_id === userId) {
                throw new common_1.BadRequestException('You cannot flag your own report');
            }
            const existing = await client.query('select id from report_flags where report_id = $1 and user_id = $2 limit 1', [id, userId]);
            if (!existing.rows[0]) {
                await client.query(`
          insert into report_flags (report_id, user_id, reason)
          values ($1, $2, $3)
        `, [id, userId, body?.reason ?? null]);
            }
            const signals = await (0, credibility_logic_1.refreshReportSignals)(client, id);
            await (0, credibility_logic_1.refreshCredibilityProfile)(client, report.user_id);
            return {
                reportId: id,
                flagged: true,
                classification: signals.classification.classification,
                distributionStatus: signals.distribution.status,
                corroborationCount: signals.corroborationCount,
            };
        });
    }
    async confirm(userId, id) {
        return this.db.transaction(async (client) => {
            const reportResult = await client.query('select id, user_id from reports where id = $1 limit 1', [id]);
            const report = reportResult.rows[0];
            if (!report) {
                throw new common_1.NotFoundException('Report not found');
            }
            if (report.user_id === userId) {
                throw new common_1.BadRequestException('You cannot confirm your own report');
            }
            const existing = await client.query('select id from report_confirmations where report_id = $1 and user_id = $2 limit 1', [id, userId]);
            if (!existing.rows[0]) {
                await client.query(`
          insert into report_confirmations (report_id, user_id)
          values ($1, $2)
        `, [id, userId]);
            }
            const signals = await (0, credibility_logic_1.refreshReportSignals)(client, id);
            await (0, credibility_logic_1.refreshCredibilityProfile)(client, report.user_id);
            return {
                reportId: id,
                confirmed: true,
                classification: signals.classification.classification,
                distributionStatus: signals.distribution.status,
                corroborationCount: signals.corroborationCount,
            };
        });
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map
