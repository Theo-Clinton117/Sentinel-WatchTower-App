"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyReportAndRefresh = exports.refreshReportSignals = exports.evaluateReportOnCreate = exports.refreshCredibilityProfile = exports.getCredibilityProfile = exports.ensureCredibilityProfile = exports.mapCredibilityProfileRow = void 0;
const common_1 = require("@nestjs/common");
const DEFAULT_SCORE = 50;
const SCORE_LIMITS = { min: 0, max: 100 };
const REPORT_CLASSIFICATIONS = new Set([
    'confirmed_true',
    'likely_true',
    'inconclusive',
    'false',
    'malicious',
]);
const RESPONSE_OUTCOMES = new Set([
    'pending',
    'validated',
    'action_taken',
    'dismissed',
    'no_action',
]);
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(Number(value || 0) * factor) / factor;
}
function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function getRatingTier(score) {
    if (score >= 80) {
        return 'high';
    }
    if (score >= 45) {
        return 'mid';
    }
    return 'low';
}
function getRestrictionLevel(stats) {
    if (stats.maliciousReportsCount >= 3) {
        return 'ban';
    }
    if (stats.maliciousReportsCount >= 2 || stats.falseReportsCount >= 5) {
        return 'shadow_restriction';
    }
    if (stats.maliciousReportsCount >= 1 || stats.falseReportsCount >= 3) {
        return 'temporary_restriction';
    }
    if (stats.falseReportsCount >= 1) {
        return 'warning';
    }
    return 'none';
}
function normalizeAiConfidence(value) {
    const confidence = toNumber(value, 0);
    if (confidence > 1) {
        return clamp(confidence / 100, 0, 1);
    }
    return clamp(confidence, 0, 1);
}
function mapCredibilityProfileRow(row) {
    if (!row) {
        return {
            score: DEFAULT_SCORE,
            ratingTier: getRatingTier(DEFAULT_SCORE),
            restrictionLevel: 'none',
            restrictionExpiresAt: null,
            warningCount: 0,
            totalReportsCount: 0,
            confirmedTrueReportsCount: 0,
            likelyTrueReportsCount: 0,
            inconclusiveReportsCount: 0,
            falseReportsCount: 0,
            maliciousReportsCount: 0,
            corroboratedReportsCount: 0,
            qualityScoreAverage: 0,
            lastReportedAt: null,
            lastScoredAt: null,
            createdAt: null,
            updatedAt: null,
        };
    }
    return {
        id: row.id,
        userId: row.user_id,
        score: toNumber(row.score, DEFAULT_SCORE),
        ratingTier: row.rating_tier || getRatingTier(DEFAULT_SCORE),
        restrictionLevel: row.restriction_level || 'none',
        restrictionExpiresAt: row.restriction_expires_at || null,
        warningCount: toNumber(row.warning_count, 0),
        totalReportsCount: toNumber(row.total_reports_count, 0),
        confirmedTrueReportsCount: toNumber(row.confirmed_true_reports_count, 0),
        likelyTrueReportsCount: toNumber(row.likely_true_reports_count, 0),
        inconclusiveReportsCount: toNumber(row.inconclusive_reports_count, 0),
        falseReportsCount: toNumber(row.false_reports_count, 0),
        maliciousReportsCount: toNumber(row.malicious_reports_count, 0),
        corroboratedReportsCount: toNumber(row.corroborated_reports_count, 0),
        qualityScoreAverage: round(row.quality_score_avg, 1),
        lastReportedAt: row.last_reported_at || null,
        lastScoredAt: row.last_scored_at || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
    };
}
exports.mapCredibilityProfileRow = mapCredibilityProfileRow;
async function ensureCredibilityProfile(queryable, userId) {
    const existing = await queryable.query(`
    select *
    from user_credibility_profiles
    where user_id = $1
    limit 1
  `, [userId]);
    if (existing.rows[0]) {
        return mapCredibilityProfileRow(existing.rows[0]);
    }
    const created = await queryable.query(`
    insert into user_credibility_profiles (
      user_id,
      score,
      rating_tier,
      restriction_level,
      warning_count,
      total_reports_count,
      confirmed_true_reports_count,
      likely_true_reports_count,
      inconclusive_reports_count,
      false_reports_count,
      malicious_reports_count,
      corroborated_reports_count,
      quality_score_avg,
      last_scored_at
    )
    values ($1, $2, $3, 'none', 0, 0, 0, 0, 0, 0, 0, 0, 0, now())
    on conflict (user_id) do update
      set updated_at = now()
    returning *
  `, [userId, DEFAULT_SCORE, getRatingTier(DEFAULT_SCORE)]);
    return mapCredibilityProfileRow(created.rows[0]);
}
exports.ensureCredibilityProfile = ensureCredibilityProfile;
async function getCredibilityProfile(queryable, userId) {
    return ensureCredibilityProfile(queryable, userId);
}
exports.getCredibilityProfile = getCredibilityProfile;
function calculateQualityScore(payload) {
    let score = 10;
    const titleLength = String(payload?.title || '').trim().length;
    const descriptionLength = String(payload?.description || '').trim().length;
    const mediaCount = Array.isArray(payload?.media) ? payload.media.filter((item) => item?.url).length : toNumber(payload?.mediaCount, 0);
    const hasLatLng = Number.isFinite(toNumber(payload?.lat, Number.NaN)) && Number.isFinite(toNumber(payload?.lng, Number.NaN));
    const locationAccuracy = payload?.locationAccuracyM == null ? null : toNumber(payload.locationAccuracyM, Number.NaN);
    if (titleLength >= 12) {
        score += 15;
    }
    else if (titleLength >= 6) {
        score += 8;
    }
    if (descriptionLength >= 140) {
        score += 30;
    }
    else if (descriptionLength >= 60) {
        score += 22;
    }
    else if (descriptionLength >= 20) {
        score += 12;
    }
    score += Math.min(30, mediaCount * 15);
    if (hasLatLng) {
        score += 15;
        if (Number.isFinite(locationAccuracy)) {
            if (locationAccuracy <= 25) {
                score += 15;
            }
            else if (locationAccuracy <= 100) {
                score += 8;
            }
            else {
                score += 3;
            }
        }
    }
    return clamp(score, 0, 100);
}
function calculateInactivityPenalty(lastReportedAt) {
    if (!lastReportedAt) {
        return 0;
    }
    const lastSeen = new Date(lastReportedAt).getTime();
    if (!Number.isFinite(lastSeen)) {
        return 0;
    }
    const inactiveDays = Math.floor((Date.now() - lastSeen) / (1000 * 60 * 60 * 24));
    const inactiveMonths = Math.max(0, Math.floor(inactiveDays / 30));
    return Math.min(12, inactiveMonths * 2);
}
function calculateConsistencyAdjustment(stats) {
    if (stats.totalReportsCount < 2) {
        return 0;
    }
    const positiveSignals = stats.confirmedTrueReportsCount + stats.likelyTrueReportsCount * 0.75;
    const ratio = positiveSignals / Math.max(stats.totalReportsCount, 1);
    if (ratio >= 0.8) {
        return 8;
    }
    if (ratio >= 0.65) {
        return 4;
    }
    if (ratio >= 0.45) {
        return 0;
    }
    return -6;
}
function computeCredibilityScore(stats) {
    const qualityBoost = clamp(Math.round((stats.qualityScoreAverage - 50) / 8), -6, 6);
    const corroborationBoost = Math.min(12, stats.corroboratedReportsCount * 2);
    const responseBoost = Math.min(8, stats.validatedReportsCount * 2 + stats.actionTakenReportsCount * 3);
    const inactivityPenalty = calculateInactivityPenalty(stats.lastReportedAt);
    const consistencyAdjustment = calculateConsistencyAdjustment(stats);
    const rawScore = DEFAULT_SCORE
        + stats.confirmedTrueReportsCount * 7
        + stats.likelyTrueReportsCount * 4
        - stats.falseReportsCount * 3
        - stats.maliciousReportsCount * 18
        + qualityBoost
        + corroborationBoost
        + responseBoost
        + consistencyAdjustment
        - inactivityPenalty;
    const experienceFactor = clamp(stats.totalReportsCount / 5, 0, 1);
    const dampenedScore = DEFAULT_SCORE + (rawScore - DEFAULT_SCORE) * experienceFactor;
    return clamp(Math.round(dampenedScore), SCORE_LIMITS.min, SCORE_LIMITS.max);
}
function deriveInitialClassification(signals) {
    if (signals.corroborationCount >= 2) {
        return 'likely_true';
    }
    if (signals.corroborationCount >= 1 && (signals.aiConfidence >= 0.65 || signals.qualityScore >= 70)) {
        return 'likely_true';
    }
    return 'inconclusive';
}
function computeCredibilitySnapshot(profileScore, qualityScore, corroborationCount, aiConfidence) {
    const corroborationBoost = Math.min(15, corroborationCount * 6);
    return clamp(Math.round(profileScore * 0.55 + qualityScore * 0.25 + corroborationBoost + aiConfidence * 20), 0, 100);
}
function buildDistributionDecision(input) {
    const highConfidence = input.corroborationCount >= 2 || input.aiConfidence >= 0.85;
    const moderateConfidence = input.corroborationCount >= 1 || input.aiConfidence >= 0.75 || input.qualityScore >= 70;
    const criticalSeverity = input.severity === 'critical';
    const highSeverity = input.severity === 'high';
    const mediumSeverity = input.severity === 'medium';
    const lowSeverity = input.severity === 'low';
    const spammy = input.recentReportCount >= 4;
    if (input.restrictionLevel === 'ban') {
        return {
            visibilityScope: 'none',
            status: 'blocked',
            reason: 'account_banned',
            requiresManualReview: true,
            restrictionApplied: 'ban',
            throttledUntil: null,
        };
    }
    if (input.restrictionLevel === 'shadow_restriction') {
        return {
            visibilityScope: 'nearby_only',
            status: 'sandboxed',
            reason: 'shadow_restriction_active',
            requiresManualReview: true,
            restrictionApplied: 'shadow_restriction',
            throttledUntil: null,
        };
    }
    if (input.restrictionLevel === 'temporary_restriction' && input.restrictionExpiresAt && new Date(input.restrictionExpiresAt).getTime() > Date.now()) {
        return {
            visibilityScope: 'nearby_only',
            status: 'throttled',
            reason: 'temporary_restriction_active',
            requiresManualReview: true,
            restrictionApplied: 'temporary_restriction',
            throttledUntil: input.restrictionExpiresAt,
        };
    }
    if (lowSeverity) {
        return {
            visibilityScope: 'feed_only',
            status: 'feed_only',
            reason: 'low_severity_feed_update',
            requiresManualReview: false,
            restrictionApplied: 'none',
            throttledUntil: null,
        };
    }
    if (spammy) {
        return {
            visibilityScope: 'nearby_only',
            status: 'throttled',
            reason: 'cooldown_after_repeated_reports',
            requiresManualReview: true,
            restrictionApplied: 'cooldown',
            throttledUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
    }
    if (criticalSeverity) {
        if (input.ratingTier === 'high' || highConfidence) {
            return {
                visibilityScope: 'network_priority',
                status: 'priority',
                reason: 'critical_immediate_push',
                requiresManualReview: false,
                restrictionApplied: 'none',
                throttledUntil: null,
            };
        }
        if (input.ratingTier === 'mid' || moderateConfidence) {
            return {
                visibilityScope: 'nearby_priority',
                status: 'priority',
                reason: 'critical_nearby_push',
                requiresManualReview: true,
                restrictionApplied: 'none',
                throttledUntil: null,
            };
        }
        return {
            visibilityScope: 'nearby_only',
            status: 'needs_corroboration',
            reason: 'critical_waiting_for_corroboration',
            requiresManualReview: true,
            restrictionApplied: 'none',
            throttledUntil: null,
        };
    }
    if (highSeverity) {
        if (input.ratingTier === 'high' || moderateConfidence) {
            return {
                visibilityScope: 'nearby_push',
                status: 'high_priority',
                reason: 'high_severity_nearby_push',
                requiresManualReview: false,
                restrictionApplied: 'none',
                throttledUntil: null,
            };
        }
        return {
            visibilityScope: 'nearby_only',
            status: 'needs_corroboration',
            reason: 'high_severity_waiting_for_support',
            requiresManualReview: true,
            restrictionApplied: 'none',
            throttledUntil: null,
        };
    }
    if (mediumSeverity) {
        if (input.ratingTier === 'high' || moderateConfidence) {
            return {
                visibilityScope: 'map_and_feed',
                status: 'batched',
                reason: 'medium_severity_batched_update',
                requiresManualReview: false,
                restrictionApplied: 'none',
                throttledUntil: null,
            };
        }
        return {
            visibilityScope: 'nearby_only',
            status: 'batched',
            reason: 'medium_severity_local_batch',
            requiresManualReview: false,
            restrictionApplied: 'none',
            throttledUntil: null,
        };
    }
    if (input.ratingTier === 'high') {
        return {
            visibilityScope: 'network',
            status: 'immediate',
            reason: 'high_trust_reporter',
            requiresManualReview: false,
            restrictionApplied: 'none',
            throttledUntil: null,
        };
    }
    if (input.ratingTier === 'mid') {
        if (moderateConfidence) {
            return {
                visibilityScope: criticalSeverity ? 'network_priority' : 'network',
                status: 'immediate',
                reason: 'mid_trust_supported_by_signals',
                requiresManualReview: false,
                restrictionApplied: 'none',
                throttledUntil: null,
            };
        }
        return {
            visibilityScope: 'nearby_only',
            status: 'needs_corroboration',
            reason: 'mid_trust_waiting_for_corroboration',
            requiresManualReview: criticalSeverity,
            restrictionApplied: 'none',
            throttledUntil: null,
        };
    }
    if (highConfidence) {
        return {
            visibilityScope: 'nearby_only',
            status: 'limited_release',
            reason: 'low_trust_temporarily_boosted_by_corroboration',
            requiresManualReview: criticalSeverity,
            restrictionApplied: 'none',
            throttledUntil: null,
        };
    }
    return {
        visibilityScope: 'nearby_only',
        status: 'sandboxed',
        reason: 'low_trust_reporter',
        requiresManualReview: true,
        restrictionApplied: 'none',
        throttledUntil: null,
    };
}
async function countNearbyReports(queryable, report) {
    if (report.lat == null || report.lng == null) {
        return 0;
    }
    const result = await queryable.query(`
    select count(*)::int as nearby_count
    from reports r
    where r.id <> $1
      and r.user_id <> $2
      and r.lat is not null
      and r.lng is not null
      and abs(r.lat - $3) <= 0.02
      and abs(r.lng - $4) <= 0.02
      and r.created_at between ($5::timestamptz - interval '90 minutes') and ($5::timestamptz + interval '90 minutes')
  `, [report.id, report.user_id, report.lat, report.lng, report.created_at]);
    return toNumber(result.rows[0]?.nearby_count, 0);
}
async function countRecentReports(queryable, userId) {
    const result = await queryable.query(`
    select count(*)::int as recent_count
    from reports
    where user_id = $1
      and created_at >= (now() - interval '1 hour')
  `, [userId]);
    return toNumber(result.rows[0]?.recent_count, 0);
}
async function loadReportSignals(queryable, reportId) {
    const result = await queryable.query(`
    select
      r.*,
      (select count(*)::int from report_confirmations rc where rc.report_id = r.id) as confirmations_count,
      (select count(*)::int from report_flags rf where rf.report_id = r.id) as flags_count,
      (select count(*)::int from report_media rm where rm.report_id = r.id) as media_count,
      rc.classification,
      rc.response_outcome,
      rc.ai_confidence,
      rc.quality_score,
      rc.corroboration_count,
      rc.credibility_snapshot,
      rc.reviewed_at,
      rc.reviewed_by,
      rc.notes
    from reports r
    left join report_classifications rc on rc.report_id = r.id
    where r.id = $1
    limit 1
  `, [reportId]);
    return result.rows[0] || null;
}
async function upsertReportClassification(queryable, payload) {
    const result = await queryable.query(`
    insert into report_classifications (
      report_id,
      classification,
      response_outcome,
      ai_confidence,
      quality_score,
      credibility_snapshot,
      corroboration_count,
      notes,
      reviewed_by,
      reviewed_at,
      updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
    on conflict (report_id) do update
      set classification = excluded.classification,
          response_outcome = excluded.response_outcome,
          ai_confidence = excluded.ai_confidence,
          quality_score = excluded.quality_score,
          credibility_snapshot = excluded.credibility_snapshot,
          corroboration_count = excluded.corroboration_count,
          notes = coalesce(excluded.notes, report_classifications.notes),
          reviewed_by = coalesce(excluded.reviewed_by, report_classifications.reviewed_by),
          reviewed_at = coalesce(excluded.reviewed_at, report_classifications.reviewed_at),
          updated_at = now()
    returning *
  `, [
        payload.reportId,
        payload.classification,
        payload.responseOutcome,
        payload.aiConfidence,
        payload.qualityScore,
        payload.credibilitySnapshot,
        payload.corroborationCount,
        payload.notes ?? null,
        payload.reviewedBy ?? null,
        payload.reviewedAt ?? null,
    ]);
    return result.rows[0];
}
async function updateReportDistribution(queryable, reportId, distribution) {
    await queryable.query(`
    update reports
    set visibility_scope = $2,
        distribution_status = $3,
        distribution_reason = $4,
        requires_manual_review = $5,
        throttled_until = $6,
        restriction_applied = $7
    where id = $1
  `, [
        reportId,
        distribution.visibilityScope,
        distribution.status,
        distribution.reason,
        distribution.requiresManualReview,
        distribution.throttledUntil ?? null,
        distribution.restrictionApplied ?? 'none',
    ]);
}
async function evaluateReportOnCreate(queryable, userId, report, mediaItems) {
    const profile = await ensureCredibilityProfile(queryable, userId);
    const nearbyCorroborations = await countNearbyReports(queryable, report);
    const confirmationCount = 0;
    const flagCount = 0;
    const corroborationCount = nearbyCorroborations + confirmationCount;
    const qualityScore = calculateQualityScore({
        title: report.title,
        description: report.description,
        media: mediaItems,
        lat: report.lat,
        lng: report.lng,
        locationAccuracyM: report.location_accuracy_m,
    });
    const aiConfidence = normalizeAiConfidence(report.ai_confidence);
    const recentReportCount = await countRecentReports(queryable, userId);
    const distribution = buildDistributionDecision({
        ratingTier: profile.ratingTier,
        restrictionLevel: profile.restrictionLevel,
        restrictionExpiresAt: profile.restrictionExpiresAt,
        qualityScore,
        corroborationCount,
        aiConfidence,
        severity: report.severity || 'medium',
        recentReportCount,
    });
    const classification = deriveInitialClassification({
        corroborationCount,
        confirmationCount,
        flagCount,
        qualityScore,
        aiConfidence,
    });
    const credibilitySnapshot = computeCredibilitySnapshot(profile.score, qualityScore, corroborationCount, aiConfidence);
    await upsertReportClassification(queryable, {
        reportId: report.id,
        classification,
        responseOutcome: 'pending',
        aiConfidence,
        qualityScore,
        credibilitySnapshot,
        corroborationCount,
    });
    await updateReportDistribution(queryable, report.id, distribution);
    return {
        profile,
        classification,
        distribution,
        qualityScore,
        credibilitySnapshot,
        corroborationCount,
    };
}
exports.evaluateReportOnCreate = evaluateReportOnCreate;
async function refreshReportSignals(queryable, reportId) {
    const report = await loadReportSignals(queryable, reportId);
    if (!report) {
        throw new common_1.NotFoundException('Report not found');
    }
    const profile = await ensureCredibilityProfile(queryable, report.user_id);
    const nearbyCorroborations = await countNearbyReports(queryable, report);
    const confirmationCount = toNumber(report.confirmations_count, 0);
    const flagCount = toNumber(report.flags_count, 0);
    const corroborationCount = nearbyCorroborations + confirmationCount;
    const qualityScore = report.quality_score == null
        ? calculateQualityScore({
            title: report.title,
            description: report.description,
            mediaCount: report.media_count,
            lat: report.lat,
            lng: report.lng,
            locationAccuracyM: report.location_accuracy_m,
        })
        : toNumber(report.quality_score, 0);
    const aiConfidence = normalizeAiConfidence(report.ai_confidence);
    const recentReportCount = await countRecentReports(queryable, report.user_id);
    const existingClassification = report.classification || 'inconclusive';
    const classification = ['confirmed_true', 'false', 'malicious'].includes(existingClassification)
        ? existingClassification
        : deriveInitialClassification({
            corroborationCount,
            confirmationCount,
            flagCount,
            qualityScore,
            aiConfidence,
        });
    const distribution = buildDistributionDecision({
        ratingTier: profile.ratingTier,
        restrictionLevel: profile.restrictionLevel,
        restrictionExpiresAt: profile.restrictionExpiresAt,
        qualityScore,
        corroborationCount,
        aiConfidence,
        severity: report.severity || 'medium',
        recentReportCount,
    });
    if (flagCount >= 3 && confirmationCount === 0 && !['confirmed_true', 'malicious'].includes(existingClassification)) {
        distribution.status = 'needs_review';
        distribution.reason = 'community_flags_require_review';
        distribution.requiresManualReview = true;
    }
    const credibilitySnapshot = computeCredibilitySnapshot(profile.score, qualityScore, corroborationCount, aiConfidence);
    const updatedClassification = await upsertReportClassification(queryable, {
        reportId,
        classification,
        responseOutcome: report.response_outcome || 'pending',
        aiConfidence,
        qualityScore,
        credibilitySnapshot,
        corroborationCount,
        notes: report.notes,
        reviewedBy: report.reviewed_by,
        reviewedAt: report.reviewed_at,
    });
    await updateReportDistribution(queryable, reportId, distribution);
    return {
        classification: updatedClassification,
        distribution,
        corroborationCount,
        qualityScore,
        credibilitySnapshot,
    };
}
exports.refreshReportSignals = refreshReportSignals;
async function refreshCredibilityProfile(queryable, userId) {
    const currentProfile = await ensureCredibilityProfile(queryable, userId);
    const result = await queryable.query(`
    select
      count(r.id)::int as total_reports_count,
      count(*) filter (where rc.classification = 'confirmed_true')::int as confirmed_true_reports_count,
      count(*) filter (where rc.classification = 'likely_true')::int as likely_true_reports_count,
      count(*) filter (where rc.classification = 'inconclusive')::int as inconclusive_reports_count,
      count(*) filter (where rc.classification = 'false')::int as false_reports_count,
      count(*) filter (where rc.classification = 'malicious')::int as malicious_reports_count,
      count(*) filter (where coalesce(rc.corroboration_count, 0) >= 2)::int as corroborated_reports_count,
      count(*) filter (where rc.response_outcome = 'validated')::int as validated_reports_count,
      count(*) filter (where rc.response_outcome = 'action_taken')::int as action_taken_reports_count,
      coalesce(avg(rc.quality_score), 0)::float as quality_score_avg,
      max(r.created_at) as last_reported_at
    from reports r
    left join report_classifications rc on rc.report_id = r.id
    where r.user_id = $1
  `, [userId]);
    const row = result.rows[0] || {};
    const stats = {
        totalReportsCount: toNumber(row.total_reports_count, 0),
        confirmedTrueReportsCount: toNumber(row.confirmed_true_reports_count, 0),
        likelyTrueReportsCount: toNumber(row.likely_true_reports_count, 0),
        inconclusiveReportsCount: toNumber(row.inconclusive_reports_count, 0),
        falseReportsCount: toNumber(row.false_reports_count, 0),
        maliciousReportsCount: toNumber(row.malicious_reports_count, 0),
        corroboratedReportsCount: toNumber(row.corroborated_reports_count, 0),
        validatedReportsCount: toNumber(row.validated_reports_count, 0),
        actionTakenReportsCount: toNumber(row.action_taken_reports_count, 0),
        qualityScoreAverage: round(row.quality_score_avg, 1),
        lastReportedAt: row.last_reported_at || null,
    };
    const warningCount = stats.falseReportsCount + stats.maliciousReportsCount * 2;
    const score = computeCredibilityScore(stats);
    const restrictionLevel = getRestrictionLevel(stats);
    let restrictionExpiresAt = null;
    if (restrictionLevel === 'temporary_restriction') {
        const currentExpiry = currentProfile?.restrictionExpiresAt ? new Date(currentProfile.restrictionExpiresAt).getTime() : 0;
        restrictionExpiresAt = currentExpiry > Date.now()
            ? currentProfile.restrictionExpiresAt
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }
    const ratingTier = getRatingTier(score);
    const upserted = await queryable.query(`
    insert into user_credibility_profiles (
      user_id,
      score,
      rating_tier,
      restriction_level,
      restriction_expires_at,
      warning_count,
      total_reports_count,
      confirmed_true_reports_count,
      likely_true_reports_count,
      inconclusive_reports_count,
      false_reports_count,
      malicious_reports_count,
      corroborated_reports_count,
      quality_score_avg,
      last_reported_at,
      last_scored_at,
      updated_at
    )
    values (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12, $13,
      $14, $15, now(), now()
    )
    on conflict (user_id) do update
      set score = excluded.score,
          rating_tier = excluded.rating_tier,
          restriction_level = excluded.restriction_level,
          restriction_expires_at = excluded.restriction_expires_at,
          warning_count = excluded.warning_count,
          total_reports_count = excluded.total_reports_count,
          confirmed_true_reports_count = excluded.confirmed_true_reports_count,
          likely_true_reports_count = excluded.likely_true_reports_count,
          inconclusive_reports_count = excluded.inconclusive_reports_count,
          false_reports_count = excluded.false_reports_count,
          malicious_reports_count = excluded.malicious_reports_count,
          corroborated_reports_count = excluded.corroborated_reports_count,
          quality_score_avg = excluded.quality_score_avg,
          last_reported_at = excluded.last_reported_at,
          last_scored_at = now(),
          updated_at = now()
    returning *
  `, [
        userId,
        score,
        ratingTier,
        restrictionLevel,
        restrictionExpiresAt,
        warningCount,
        stats.totalReportsCount,
        stats.confirmedTrueReportsCount,
        stats.likelyTrueReportsCount,
        stats.inconclusiveReportsCount,
        stats.falseReportsCount,
        stats.maliciousReportsCount,
        stats.corroboratedReportsCount,
        stats.qualityScoreAverage,
        stats.lastReportedAt,
    ]);
    return mapCredibilityProfileRow(upserted.rows[0]);
}
exports.refreshCredibilityProfile = refreshCredibilityProfile;
async function classifyReportAndRefresh(queryable, payload) {
    if (!REPORT_CLASSIFICATIONS.has(payload.classification)) {
        throw new common_1.BadRequestException('Invalid classification');
    }
    const responseOutcome = payload.responseOutcome || 'pending';
    if (!RESPONSE_OUTCOMES.has(responseOutcome)) {
        throw new common_1.BadRequestException('Invalid response outcome');
    }
    const report = await loadReportSignals(queryable, payload.reportId);
    if (!report) {
        throw new common_1.NotFoundException('Report not found');
    }
    const aiConfidence = normalizeAiConfidence(payload.aiConfidence ?? report.ai_confidence);
    const qualityScore = payload.qualityScore == null
        ? (report.quality_score == null
            ? calculateQualityScore({
                title: report.title,
                description: report.description,
                mediaCount: report.media_count,
                lat: report.lat,
                lng: report.lng,
                locationAccuracyM: report.location_accuracy_m,
            })
            : toNumber(report.quality_score, 0))
        : clamp(toNumber(payload.qualityScore, 0), 0, 100);
    const corroborationCount = payload.corroborationCount == null
        ? toNumber(report.corroboration_count, 0)
        : toNumber(payload.corroborationCount, 0);
    const profile = await ensureCredibilityProfile(queryable, report.user_id);
    const credibilitySnapshot = computeCredibilitySnapshot(profile.score, qualityScore, corroborationCount, aiConfidence);
    const reviewedAt = new Date().toISOString();
    const classification = await upsertReportClassification(queryable, {
        reportId: payload.reportId,
        classification: payload.classification,
        responseOutcome,
        aiConfidence,
        qualityScore,
        credibilitySnapshot,
        corroborationCount,
        notes: payload.notes,
        reviewedBy: payload.reviewedBy,
        reviewedAt,
    });
    const nextStatus = payload.classification === 'confirmed_true'
        ? 'validated'
        : payload.classification === 'likely_true'
            ? 'under_review'
            : payload.classification === 'inconclusive'
                ? 'open'
                : payload.classification === 'false'
                    ? 'dismissed'
                    : 'blocked';
    await queryable.query(`
    update reports
    set status = $2,
        requires_manual_review = $3,
        distribution_reason = $4
    where id = $1
  `, [
        payload.reportId,
        nextStatus,
        ['false', 'malicious'].includes(payload.classification),
        payload.notes ?? null,
    ]);
    const profileAfterRefresh = await refreshCredibilityProfile(queryable, report.user_id);
    await refreshReportSignals(queryable, payload.reportId);
    return {
        reportId: payload.reportId,
        classification,
        profile: profileAfterRefresh,
    };
}
exports.classifyReportAndRefresh = classifyReportAndRefresh;
