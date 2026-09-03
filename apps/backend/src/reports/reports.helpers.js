"use strict";

const common_1 = require("@nestjs/common");
const field_encryption_1 = require("../common/field-encryption");

const MAX_REPORT_TITLE_LENGTH = 120;
const MAX_REPORT_DESCRIPTION_LENGTH = 2000;
const MAX_REPORT_MEDIA_ITEMS = 6;

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

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
    severity: row.severity || "medium",
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
      status: row.distribution_status || "queued",
      reason: row.distribution_reason || null,
      visibilityScope: row.visibility_scope || "nearby_only",
      requiresManualReview: Boolean(row.requires_manual_review),
      throttledUntil: row.throttled_until || null,
      restrictionApplied: row.restriction_applied || "none",
    },
    classification: {
      status: row.classification || "inconclusive",
      responseOutcome: row.response_outcome || "pending",
      aiConfidence: toNumber(row.ai_confidence, 0),
      qualityScore: toNumber(row.quality_score, 0),
      credibilitySnapshot: toNumber(row.credibility_snapshot, 0),
      corroborationCount: toNumber(row.corroboration_count, 0),
      reviewedAt: row.reviewed_at || null,
      reviewedBy: row.reviewed_by || null,
      notes: (0, field_encryption_1.decryptField)(row.notes) || null,
    },
  };
}

function validateCoordinates(body) {
  const hasLat = body?.lat !== undefined && body?.lat !== null;
  const hasLng = body?.lng !== undefined && body?.lng !== null;
  if (hasLat !== hasLng) {
    throw new common_1.BadRequestException("lat and lng must be provided together");
  }
  if (!hasLat && !hasLng) {
    return;
  }
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new common_1.BadRequestException("lat must be between -90 and 90");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new common_1.BadRequestException("lng must be between -180 and 180");
  }
}

function normalizeReportText(value, maxLength) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, maxLength);
}

function normalizeMediaItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  if (value.length > MAX_REPORT_MEDIA_ITEMS) {
    throw new common_1.BadRequestException(`A maximum of ${MAX_REPORT_MEDIA_ITEMS} media items can be attached`);
  }
  return value
    .map((item) => {
      const rawUrl = String(item?.url || "").trim();
      if (!rawUrl) {
        return null;
      }
      let parsedUrl;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        throw new common_1.BadRequestException("media url must be a valid URL");
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new common_1.BadRequestException("media url must use http or https");
      }
      if (isProductionRuntime() && parsedUrl.protocol !== "https:") {
        throw new common_1.BadRequestException("media url must use https in production");
      }
      return {
        url: parsedUrl.toString(),
        mimeType: item?.mimeType ? String(item.mimeType).trim().slice(0, 120) : null,
      };
    })
    .filter(Boolean);
}

module.exports = {
  MAX_REPORT_TITLE_LENGTH,
  MAX_REPORT_DESCRIPTION_LENGTH,
  MAX_REPORT_MEDIA_ITEMS,
  isProductionRuntime,
  toNumber,
  mapReportRow,
  validateCoordinates,
  normalizeReportText,
  normalizeMediaItems,
};
