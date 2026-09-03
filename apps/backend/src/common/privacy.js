"use strict";

const AUDIT_SENSITIVE_KEY_PATTERN = /(^|[_-])(email|phone|contact|recipient|location|address|lat|lng|geo|coords?|message|subject|token|secret|password|note|body)([_-]|$)/i;
const NOTIFICATION_ALLOWED_KEYS = new Set(['message', 'subject', 'reason', 'recipientName', 'alertId', 'stage', 'channel', 'status', 'type', 'audience', 'actorName', 'triggerSource', 'error', 'deliveryChannel', 'recipientUserId']);
const MAX_STRING_LENGTH = 240;
const MAX_DEPTH = 3;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeValue(value, depth = 0, sensitiveKeyPattern = AUDIT_SENSITIVE_KEY_PATTERN) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, MAX_STRING_LENGTH) : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return [];
    }

    return value
      .map((item) => sanitizeValue(item, depth + 1, sensitiveKeyPattern))
      .filter((item) => item !== null && item !== undefined);
  }

  if (!isPlainObject(value) || depth >= MAX_DEPTH) {
    return null;
  }

  return Object.entries(value).reduce((acc, [key, entry]) => {
    if (sensitiveKeyPattern.test(key)) {
      return acc;
    }

    const sanitized = sanitizeValue(entry, depth + 1, sensitiveKeyPattern);
    if (sanitized !== null && sanitized !== undefined) {
      acc[key] = sanitized;
    }

    return acc;
  }, {});
}

function sanitizeAuditMetadata(metadata) {
  const sanitized = sanitizeValue(metadata, 0, AUDIT_SENSITIVE_KEY_PATTERN);
  return isPlainObject(sanitized) ? sanitized : {};
}

function sanitizeNotificationPayload(payload) {
  if (!isPlainObject(payload)) {
    return {};
  }

  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (!NOTIFICATION_ALLOWED_KEYS.has(key)) {
      return acc;
    }

    const sanitized = sanitizeValue(value, 1, AUDIT_SENSITIVE_KEY_PATTERN);
    if (sanitized !== null && sanitized !== undefined) {
      acc[key] = sanitized;
    }

    return acc;
  }, {});
}

module.exports = {
  sanitizeAuditMetadata,
  sanitizeNotificationPayload,
};
