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
const pagination_1 = require("../common/pagination");
const reports = require("./reports.helpers");
const MAX_REPORT_TITLE_LENGTH = reports.MAX_REPORT_TITLE_LENGTH;
const MAX_REPORT_DESCRIPTION_LENGTH = reports.MAX_REPORT_DESCRIPTION_LENGTH;
const MAX_REPORT_MEDIA_ITEMS = reports.MAX_REPORT_MEDIA_ITEMS;
const mapReportRow = reports.mapReportRow;
const validateCoordinates = reports.validateCoordinates;
const normalizeReportText = reports.normalizeReportText;
const normalizeMediaItems = reports.normalizeMediaItems;
const toNumber = reports.toNumber;
let ReportsService = class ReportsService {
    constructor(db) {
        this.db = db;
    }
    async list(userId, options = {}) {
        const { limit, offset } = (0, pagination_1.getPagination)(options);
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
      limit $2 offset $3
    `, [userId, limit, offset]);
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
        const title = normalizeReportText(body?.title, MAX_REPORT_TITLE_LENGTH);
        if (!title) {
            throw new common_1.BadRequestException('title is required');
        }
        const description = normalizeReportText(body?.description, MAX_REPORT_DESCRIPTION_LENGTH);
        validateCoordinates(body);
        if (body?.severity === 'critical' && body?.confirmedSeverity !== true) {
            throw new common_1.BadRequestException('Critical reports require confirmedSeverity=true before they can be distributed');
        }
        const severity = ['low', 'medium', 'high', 'critical'].includes(String(body?.severity || '').toLowerCase())
            ? String(body.severity).toLowerCase()
            : 'medium';
        const category = body?.category ? String(body.category).trim().toLowerCase().slice(0, 80) : null;
        const mediaItems = normalizeMediaItems(body?.media);
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
                title,
                description,
                category,
                severity,
                body?.lat ?? null,
                body?.lng ?? null,
                body?.locationAccuracyM ?? null,
            ]);
            const report = reportResult.rows[0];
            report.ai_confidence = body?.aiConfidence ?? null;
            const media = [];
            for (const item of mediaItems) {
                const mediaResult = await client.query(`
          insert into report_media (report_id, url, mime_type)
          values ($1, $2, $3)
          returning id, url, mime_type, created_at
        `, [report.id, item.url, item.mimeType]);
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
