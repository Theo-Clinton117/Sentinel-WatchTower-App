"use strict";

const crypto = require("crypto");

const ORGANIZATION_ROLES = [
  "OWNER",
  "ADMIN",
  "SAFETY_OFFICER",
  "VIEWER",
  "MEMBER",
];

const ORGANIZATION_PERMISSIONS = [
  "manage_organization",
  "manage_administrators",
  "manage_members",
  "manage_locations",
  "manage_jurisdictions",
  "manage_billing",
  "view_authorized_incidents",
  "view_incident_history",
  "send_broadcasts",
  "access_emergency_info",
  "receive_critical_alerts",
  "view_safety_info",
  "receive_relevant_alerts",
  "use_normal_sentinel",
  "view_member_location",
];

const ROLE_PERMISSION_MAP = {
  OWNER: [
    "manage_organization",
    "manage_administrators",
    "manage_members",
    "manage_locations",
    "manage_jurisdictions",
    "manage_billing",
    "view_authorized_incidents",
    "view_incident_history",
    "send_broadcasts",
    "access_emergency_info",
    "receive_critical_alerts",
    "view_member_location",
  ],
  ADMIN: [
    "manage_members",
    "manage_locations",
    "manage_jurisdictions",
    "view_authorized_incidents",
    "view_incident_history",
    "send_broadcasts",
    "access_emergency_info",
    "receive_critical_alerts",
    "view_member_location",
  ],
  SAFETY_OFFICER: [
    "view_authorized_incidents",
    "view_incident_history",
    "access_emergency_info",
    "receive_critical_alerts",
  ],
  VIEWER: ["view_safety_info"],
  MEMBER: ["receive_relevant_alerts", "use_normal_sentinel"],
};

const VALID_ORG_STATUSES = new Set(["PENDING_VERIFICATION", "VERIFIED", "SUSPENDED", "REJECTED"]);
const VALID_MEMBER_STATUSES = new Set(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]);
const VALID_ALERT_TYPES = new Set([
  "LOCAL_EMERGENCY",
  "LOCAL_SAFETY",
  "ORGANIZATION_INCIDENT",
  "ORGANIZATION_BROADCAST",
  "SYSTEM_ALERT",
]);
const SEVERITY_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function normalizeText(value, maxLength = 255) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return text.slice(0, maxLength);
}

function normalizeEmail(value) {
  const email = normalizeText(value, 320).toLowerCase();
  return email || "";
}

function normalizePhone(value) {
  return normalizeText(value, 32);
}

function normalizeSeverity(value) {
  const severity = normalizeText(value, 16).toLowerCase();
  return Object.prototype.hasOwnProperty.call(SEVERITY_WEIGHTS, severity) ? severity : "medium";
}

function normalizeStatus(value, allowed, fallback) {
  const normalized = normalizeText(value, 64).toUpperCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeAlertType(value) {
  const normalized = normalizeText(value, 64).toUpperCase();
  return VALID_ALERT_TYPES.has(normalized) ? normalized : "LOCAL_EMERGENCY";
}

function safeJsonObject(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  return value;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function buildPermissionMap(roleCode, overrides) {
  const permissions = {};
  for (const permission of ORGANIZATION_PERMISSIONS) {
    permissions[permission] = false;
  }
  for (const permission of ROLE_PERMISSION_MAP[roleCode] || []) {
    permissions[permission] = true;
  }
  const extras = safeJsonObject(overrides, {});
  for (const [key, value] of Object.entries(extras)) {
    if (ORGANIZATION_PERMISSIONS.includes(key)) {
      permissions[key] = Boolean(value);
    }
  }
  return permissions;
}

function hasPermission(membership, permission) {
  if (!membership) {
    return false;
  }
  if (membership.roleCode === "OWNER") {
    return true;
  }
  const permissions = buildPermissionMap(membership.roleCode, membership.permissions);
  return Boolean(permissions[permission]);
}

function mapOrganizationRow(row) {
  return {
    id: row.id,
    name: row.name,
    organizationType: row.organization_type,
    status: row.status || "PENDING_VERIFICATION",
    officialEmail: row.official_email || null,
    officialPhone: row.official_phone || null,
    physicalAddress: row.physical_address || null,
    registrationInfo: safeJsonObject(row.registration_info, {}),
    representativeName: row.representative_name || null,
    representativeContact: safeJsonObject(row.representative_contact, {}),
    intendedOperatingJurisdiction: row.intended_operating_jurisdiction || null,
    verifiedAt: row.verified_at || null,
    createdByUserId: row.created_by_user_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMembershipRow(row) {
  return {
    id: row.membership_id || row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    roleCode: row.role_code,
    status: row.membership_status || row.status || "INVITED",
    permissions: safeJsonObject(row.membership_permissions || row.permissions, {}),
    invitedByUserId: row.invited_by_user_id || null,
    invitationChannel: row.invitation_channel || null,
    joinedAt: row.joined_at || null,
    suspendedAt: row.suspended_at || null,
    removedAt: row.removed_at || null,
    createdAt: row.membership_created_at || row.created_at,
    updatedAt: row.membership_updated_at || row.updated_at,
  };
}

function mapLocationRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    locationType: row.location_type,
    centerLat: row.center_lat == null ? null : Number(row.center_lat),
    centerLng: row.center_lng == null ? null : Number(row.center_lng),
    boundaryGeojson: row.boundary_geojson || null,
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
  };
}

function mapJurisdictionRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    jurisdictionType: row.jurisdiction_type,
    boundaryGeojson: row.boundary_geojson || null,
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
  };
}

function mapInvitationRow(row, includeToken = false) {
  const invitation = {
    id: row.id,
    organizationId: row.organization_id,
    invitedByUserId: row.invited_by_user_id || null,
    inviteeUserId: row.invitee_user_id || null,
    inviteeEmail: row.invitee_email || null,
    inviteePhone: row.invitee_phone || null,
    invitationChannel: row.invitation_channel || "email",
    status: row.status || "INVITED",
    expiresAt: row.expires_at || null,
    acceptedAt: row.accepted_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
  };
  if (includeToken) {
    invitation.inviteToken = row.invite_token;
  }
  return invitation;
}

function severityWeight(severity) {
  return SEVERITY_WEIGHTS[normalizeSeverity(severity)];
}

function distanceMeters(left, right) {
  const earthRadius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(Number(right.lat) - Number(left.lat));
  const dLng = toRadians(Number(right.lng) - Number(left.lng));
  const lat1 = toRadians(Number(left.lat));
  const lat2 = toRadians(Number(right.lat));
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function geometryFromBoundary(boundaryGeojson) {
  const boundary = safeJsonObject(boundaryGeojson, null);
  if (!boundary) {
    return null;
  }
  if (boundary.type === "Feature" && boundary.geometry) {
    return boundary.geometry;
  }
  if (
    boundary.type === "FeatureCollection" &&
    Array.isArray(boundary.features) &&
    boundary.features[0]?.geometry
  ) {
    return boundary.features[0].geometry;
  }
  if (boundary.type === "Polygon" || boundary.type === "MultiPolygon") {
    return boundary;
  }
  return null;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const xi = Number(ring[index][0]);
    const yi = Number(ring[index][1]);
    const xj = Number(ring[previous][0]);
    const yj = Number(ring[previous][1]);
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  if (!geometry) {
    return false;
  }
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.some((ring, index) => index === 0 && pointInRing(point, ring));
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.some(
      (polygon) => Array.isArray(polygon) && polygon.some((ring, index) => index === 0 && pointInRing(point, ring)),
    );
  }
  return false;
}

function evaluateGeographicMatch(point, record) {
  const geometry = geometryFromBoundary(record.boundaryGeojson);
  if (geometry && pointInGeometry(point, geometry)) {
    return {
      matched: true,
      source: "boundary",
      distanceMeters: 0,
    };
  }
  if (record.centerLat == null || record.centerLng == null) {
    return {
      matched: false,
      source: "none",
      distanceMeters: null,
    };
  }
  const radius = Number(record.radiusM || 0);
  const currentDistance = distanceMeters(point, {
    lat: Number(record.centerLat),
    lng: Number(record.centerLng),
  });
  return {
    matched: radius > 0 ? currentDistance <= radius : false,
    source: radius > 0 ? "radius" : "center",
    distanceMeters: currentDistance,
  };
}

function deriveGeographicWeight(match) {
  if (!match) {
    return 1;
  }
  if (match.matched) {
    return 1.4;
  }
  if (match.distanceMeters == null) {
    return 1;
  }
  if (match.distanceMeters <= 250) {
    return 1.2;
  }
  if (match.distanceMeters <= 1000) {
    return 1.08;
  }
  return 1;
}

function calculateAlertPriority(input) {
  const baseSeverity = severityWeight(input.severity);
  const geographicWeight = Number(input.geographicWeight || 1);
  const jurisdictionWeight = Number(input.jurisdictionWeight || 1);
  const organizationWeight = Number(input.organizationWeight || 1);
  const userContextWeight = Number(input.userContextWeight || 1);
  return Number(
    (baseSeverity * geographicWeight * jurisdictionWeight * organizationWeight * userContextWeight).toFixed(4),
  );
}

function buildDedupeKey(payload) {
  return sha256Hex(
    JSON.stringify({
      alertType: normalizeAlertType(payload.alertType),
      severity: normalizeSeverity(payload.severity),
      lat: payload.lat == null ? null : Number(payload.lat).toFixed(5),
      lng: payload.lng == null ? null : Number(payload.lng).toFixed(5),
      organizationIds: Array.isArray(payload.organizationIds) ? [...payload.organizationIds].sort() : [],
      title: normalizeText(payload.title, 160).toLowerCase(),
    }),
  );
}

module.exports = {
  ORGANIZATION_ROLES,
  ORGANIZATION_PERMISSIONS,
  ROLE_PERMISSION_MAP,
  VALID_ORG_STATUSES,
  VALID_MEMBER_STATUSES,
  VALID_ALERT_TYPES,
  SEVERITY_WEIGHTS,
  normalizeText,
  normalizeEmail,
  normalizePhone,
  normalizeSeverity,
  normalizeStatus,
  normalizeAlertType,
  safeJsonObject,
  sha256Hex,
  buildPermissionMap,
  hasPermission,
  mapOrganizationRow,
  mapMembershipRow,
  mapLocationRow,
  mapJurisdictionRow,
  mapInvitationRow,
  severityWeight,
  distanceMeters,
  geometryFromBoundary,
  pointInRing,
  pointInGeometry,
  evaluateGeographicMatch,
  deriveGeographicWeight,
  calculateAlertPriority,
  buildDedupeKey,
};
