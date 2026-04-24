"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const credibility_logic_1 = require("../credibility/credibility.logic");
function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function mapReviewerReportRow(row) {
    const hasLocation = row.lat != null && row.lng != null;
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        description: row.description,
        status: row.status,
        category: row.category || null,
        severity: row.severity || 'medium',
        createdAt: row.created_at,
        flagsCount: toNumber(row.flags_count, 0),
        confirmationsCount: toNumber(row.confirmations_count, 0),
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
        reporter: {
            id: row.user_id,
            name: row.reporter_name || null,
            phone: row.reporter_phone || null,
            score: toNumber(row.reporter_score, 50),
            ratingTier: row.reporter_rating_tier || 'mid',
            restrictionLevel: row.reporter_restriction_level || 'none',
        },
    };
}
let AdminService = class AdminService {
    constructor(db) {
        this.db = db;
    }
    async reportsQueue(filter = 'pending') {
        const normalizedFilter = String(filter || 'pending').trim().toLowerCase();
        const whereClause = normalizedFilter === 'reviewed'
            ? `where rc.reviewed_at is not null`
            : normalizedFilter === 'flagged'
                ? `where coalesce(flag_stats.flags_count, 0) > 0`
                : normalizedFilter === 'all'
                    ? ``
                    : `where coalesce(r.requires_manual_review, false) = true
          or coalesce(flag_stats.flags_count, 0) > 0
          or coalesce(rc.response_outcome, 'pending') = 'pending'
          or coalesce(rc.classification, 'inconclusive') = 'inconclusive'`;
        const summaryResult = await this.db.query(`
      select
        count(*) filter (
          where coalesce(r.requires_manual_review, false) = true
            or coalesce(flag_stats.flags_count, 0) > 0
            or coalesce(rc.response_outcome, 'pending') = 'pending'
            or coalesce(rc.classification, 'inconclusive') = 'inconclusive'
        )::int as pending_review_count,
        count(*) filter (where rc.reviewed_at is not null)::int as reviewed_count,
        count(*) filter (where coalesce(r.severity, 'medium') in ('high', 'critical'))::int as high_priority_count,
        count(*) filter (where coalesce(flag_stats.flags_count, 0) > 0)::int as flagged_count
      from reports r
      left join report_classifications rc on rc.report_id = r.id
      left join lateral (
        select count(*)::int as flags_count
        from report_flags rf
        where rf.report_id = r.id
      ) flag_stats on true
    `);
        const result = await this.db.query(`
      select
        r.id,
        r.user_id,
        r.title,
        r.description,
        r.status,
        r.category,
        r.severity,
        r.created_at,
        r.lat,
        r.lng,
        r.location_accuracy_m,
        r.distribution_status,
        r.distribution_reason,
        r.visibility_scope,
        r.requires_manual_review,
        r.throttled_until,
        r.restriction_applied,
        coalesce(flag_stats.flags_count, 0) as flags_count,
        coalesce(confirm_stats.confirmations_count, 0) as confirmations_count,
        rc.classification,
        rc.response_outcome,
        rc.ai_confidence,
        rc.quality_score,
        rc.credibility_snapshot,
        rc.corroboration_count,
        rc.reviewed_at,
        rc.reviewed_by,
        rc.notes,
        u.name as reporter_name,
        u.phone_e164 as reporter_phone,
        ucp.score as reporter_score,
        ucp.rating_tier as reporter_rating_tier,
        ucp.restriction_level as reporter_restriction_level
      from reports r
      left join report_classifications rc on rc.report_id = r.id
      left join users u on u.id = r.user_id
      left join user_credibility_profiles ucp on ucp.user_id = r.user_id
      left join lateral (
        select count(*)::int as flags_count
        from report_flags rf
        where rf.report_id = r.id
      ) flag_stats on true
      left join lateral (
        select count(*)::int as confirmations_count
        from report_confirmations rcf
        where rcf.report_id = r.id
      ) confirm_stats on true
      ${whereClause}
      order by
        case when coalesce(r.requires_manual_review, false) then 0 else 1 end,
        case coalesce(r.severity, 'medium')
          when 'critical' then 0
          when 'high' then 1
          when 'medium' then 2
          else 3
        end,
        coalesce(flag_stats.flags_count, 0) desc,
        r.created_at desc
      limit 40
    `);
        const summary = summaryResult.rows[0] || {};
        return {
            filter: normalizedFilter,
            summary: {
                pendingReviewCount: toNumber(summary.pending_review_count, 0),
                reviewedCount: toNumber(summary.reviewed_count, 0),
                highPriorityCount: toNumber(summary.high_priority_count, 0),
                flaggedCount: toNumber(summary.flagged_count, 0),
            },
            reports: result.rows.map(mapReviewerReportRow),
        };
    }
    async activeAlerts() {
        const result = await this.db.query(`
      select
        a.id,
        a.user_id,
        a.status,
        a.trigger_source,
        a.stage,
        a.escalation_level,
        a.risk_score,
        a.created_at,
        s.id as session_id,
        s.started_at,
        s.last_location_at,
        u.phone_e164,
        u.name
      from alerts a
      left join watch_sessions s on s.alert_id = a.id and s.status = 'active'
      left join users u on u.id = a.user_id
      where a.status = 'active'
      order by a.created_at desc
    `);
        return result.rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            status: row.status,
            triggerSource: row.trigger_source,
            stage: row.stage,
            escalationLevel: row.escalation_level,
            riskScore: row.risk_score == null ? 0 : Number(row.risk_score),
            createdAt: row.created_at,
            sessionId: row.session_id,
            startedAt: row.started_at,
            lastLocationAt: row.last_location_at,
            user: {
                phone: row.phone_e164,
                name: row.name,
            },
        }));
    }
    async flagAlert(adminUserId, id, body) {
        const alertResult = await this.db.query('select id, status from alerts where id = $1 limit 1', [id]);
        const alert = alertResult.rows[0];
        if (!alert) {
            throw new common_1.NotFoundException('Alert not found');
        }
        const auditResult = await this.db.query(`
      insert into admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
      values ($1, $2, $3, $4, $5)
      returning *
    `, [
            adminUserId,
            'flag_alert',
            'alert',
            id,
            {
                reason: body?.reason ?? null,
                note: body?.note ?? null,
                alertStatus: alert.status,
            },
        ]);
        return {
            id,
            flagged: true,
            auditLogId: auditResult.rows[0].id,
        };
    }
    async classifyReport(adminUserId, id, body) {
        return this.db.transaction(async (client) => {
            const result = await (0, credibility_logic_1.classifyReportAndRefresh)(client, {
                reportId: id,
                reviewedBy: adminUserId,
                classification: body?.classification,
                responseOutcome: body?.responseOutcome,
                aiConfidence: body?.aiConfidence,
                qualityScore: body?.qualityScore,
                corroborationCount: body?.corroborationCount,
                notes: body?.notes ?? null,
            });
            const auditResult = await client.query(`
        insert into admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
        values ($1, $2, $3, $4, $5)
        returning id
      `, [
                adminUserId,
                'classify_report',
                'report',
                id,
                {
                    classification: body?.classification,
                    responseOutcome: body?.responseOutcome ?? 'pending',
                    notes: body?.notes ?? null,
                },
            ]);
            return {
                ...result,
                auditLogId: auditResult.rows[0].id,
            };
        });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], AdminService);
//# sourceMappingURL=admin.service.js.map
