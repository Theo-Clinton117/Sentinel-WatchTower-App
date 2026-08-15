"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) d(r) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAlertPriority = exports.OrganizationsService = exports.ORGANIZATION_ROLES = exports.ORGANIZATION_PERMISSIONS = void 0;
const common_1 = require("@nestjs/common");
const db_service_1 = require("../db/db.service");
const crypto = require("crypto");
const ORGANIZATION_ROLES = [
    'OWNER',
    'ADMIN',
    'SAFETY_OFFICER',
    'VIEWER',
    'MEMBER',
];
exports.ORGANIZATION_ROLES = ORGANIZATION_ROLES;
const ORGANIZATION_PERMISSIONS = [
    'manage_organization',
    'manage_administrators',
    'manage_members',
    'manage_locations',
    'manage_jurisdictions',
    'manage_billing',
    'view_authorized_incidents',
    'view_incident_history',
    'send_broadcasts',
    'access_emergency_info',
    'receive_critical_alerts',
    'view_safety_info',
    'receive_relevant_alerts',
    'use_normal_sentinel',
    'view_member_location',
];
exports.ORGANIZATION_PERMISSIONS = ORGANIZATION_PERMISSIONS;
const ROLE_PERMISSION_MAP = {
    OWNER: [
        'manage_organization',
        'manage_administrators',
        'manage_members',
        'manage_locations',
        'manage_jurisdictions',
        'manage_billing',
        'view_authorized_incidents',
        'view_incident_history',
        'send_broadcasts',
        'access_emergency_info',
        'receive_critical_alerts',
        'view_member_location',
    ],
    ADMIN: [
        'manage_members',
        'manage_locations',
        'manage_jurisdictions',
        'view_authorized_incidents',
        'view_incident_history',
        'send_broadcasts',
        'access_emergency_info',
        'receive_critical_alerts',
        'view_member_location',
    ],
    SAFETY_OFFICER: [
        'view_authorized_incidents',
        'view_incident_history',
        'access_emergency_info',
        'receive_critical_alerts',
    ],
    VIEWER: ['view_safety_info'],
    MEMBER: ['receive_relevant_alerts', 'use_normal_sentinel'],
};
const VALID_ORG_STATUSES = new Set(['PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED', 'REJECTED']);
const VALID_MEMBER_STATUSES = new Set(['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED']);
const VALID_ALERT_TYPES = new Set(['LOCAL_EMERGENCY', 'LOCAL_SAFETY', 'ORGANIZATION_INCIDENT', 'ORGANIZATION_BROADCAST', 'SYSTEM_ALERT']);
const SEVERITY_WEIGHTS = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};
function normalizeText(value, maxLength = 255) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }
    return text.slice(0, maxLength);
}
function normalizeEmail(value) {
    const email = normalizeText(value, 320).toLowerCase();
    return email || '';
}
function normalizePhone(value) {
    return normalizeText(value, 32);
}
function normalizeSeverity(value) {
    const severity = normalizeText(value, 16).toLowerCase();
    return Object.prototype.hasOwnProperty.call(SEVERITY_WEIGHTS, severity) ? severity : 'medium';
}
function normalizeStatus(value, allowed, fallback) {
    const normalized = normalizeText(value, 64).toUpperCase();
    return allowed.has(normalized) ? normalized : fallback;
}
function normalizeAlertType(value) {
    const normalized = normalizeText(value, 64).toUpperCase();
    return VALID_ALERT_TYPES.has(normalized) ? normalized : 'LOCAL_EMERGENCY';
}
function safeJsonObject(value, fallback = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return fallback;
    }
    return value;
}
function sha256Hex(value) {
    return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
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
    if (membership.roleCode === 'OWNER') {
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
        status: row.status || 'PENDING_VERIFICATION',
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
        status: row.membership_status || row.status || 'INVITED',
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
        invitationChannel: row.invitation_channel || 'email',
        status: row.status || 'INVITED',
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
    const a = Math.sin(dLat / 2) ** 2 +
        Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function geometryFromBoundary(boundaryGeojson) {
    const boundary = safeJsonObject(boundaryGeojson, null);
    if (!boundary) {
        return null;
    }
    if (boundary.type === 'Feature' && boundary.geometry) {
        return boundary.geometry;
    }
    if (boundary.type === 'FeatureCollection' && Array.isArray(boundary.features) && boundary.features[0]?.geometry) {
        return boundary.features[0].geometry;
    }
    if (boundary.type === 'Polygon' || boundary.type === 'MultiPolygon') {
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
        const intersects = yi > point.lat !== yj > point.lat &&
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
    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates.some((ring, index) => index === 0 && pointInRing(point, ring));
    }
    if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates.some((polygon) => Array.isArray(polygon) && polygon.some((ring, index) => index === 0 && pointInRing(point, ring)));
    }
    return false;
}
function evaluateGeographicMatch(point, record) {
    const geometry = geometryFromBoundary(record.boundaryGeojson);
    if (geometry && pointInGeometry(point, geometry)) {
        return {
            matched: true,
            source: 'boundary',
            distanceMeters: 0,
        };
    }
    if (record.centerLat == null || record.centerLng == null) {
        return {
            matched: false,
            source: 'none',
            distanceMeters: null,
        };
    }
    const radius = Number(record.radiusM || 0);
    const currentDistance = distanceMeters(point, { lat: Number(record.centerLat), lng: Number(record.centerLng) });
    return {
        matched: radius > 0 ? currentDistance <= radius : false,
        source: radius > 0 ? 'radius' : 'center',
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
    return Number((baseSeverity * geographicWeight * jurisdictionWeight * organizationWeight * userContextWeight).toFixed(4));
}
exports.calculateAlertPriority = calculateAlertPriority;
function buildDedupeKey(payload) {
    return sha256Hex(JSON.stringify({
        alertType: normalizeAlertType(payload.alertType),
        severity: normalizeSeverity(payload.severity),
        lat: payload.lat == null ? null : Number(payload.lat).toFixed(5),
        lng: payload.lng == null ? null : Number(payload.lng).toFixed(5),
        organizationIds: Array.isArray(payload.organizationIds) ? [...payload.organizationIds].sort() : [],
        title: normalizeText(payload.title, 160).toLowerCase(),
    }));
}
let OrganizationsService = class OrganizationsService {
    constructor(db) {
        this.db = db;
    }
    async register(userId, body) {
        const name = normalizeText(body?.name, 180);
        const organizationType = normalizeText(body?.organizationType, 80).toUpperCase();
        const officialEmail = normalizeEmail(body?.officialEmail);
        const officialPhone = normalizePhone(body?.officialPhone);
        const physicalAddress = normalizeText(body?.physicalAddress, 320);
        const representativeName = normalizeText(body?.representativeName, 180);
        const intendedOperatingJurisdiction = normalizeText(body?.intendedOperatingJurisdiction, 180);
        const registrationInfo = safeJsonObject(body?.registrationInfo, {});
        const representativeContact = safeJsonObject(body?.representativeContact, {});
        const locations = Array.isArray(body?.registeredLocations) ? body.registeredLocations : [];
        if (!name) {
            throw new common_1.BadRequestException('organization name is required');
        }
        if (!organizationType) {
            throw new common_1.BadRequestException('organization type is required');
        }
        if (!officialEmail) {
            throw new common_1.BadRequestException('official email is required');
        }
        if (!officialPhone) {
            throw new common_1.BadRequestException('official phone is required');
        }
        if (!physicalAddress) {
            throw new common_1.BadRequestException('physical address is required');
        }
        if (!representativeName) {
            throw new common_1.BadRequestException('representative name is required');
        }
        if (!intendedOperatingJurisdiction) {
            throw new common_1.BadRequestException('intended operating jurisdiction is required');
        }
        return this.db.transaction(async (client) => {
            const orgResult = await client.query(`
        insert into organizations (
          name,
          organization_type,
          status,
          official_email,
          official_phone,
          physical_address,
          registration_info,
          representative_name,
          representative_contact,
          intended_operating_jurisdiction,
          verified_at,
          created_by_user_id
        )
        values (
          $1,
          $2,
          'PENDING_VERIFICATION',
          $3,
          $4,
          $5,
          $6::jsonb,
          $7,
          $8::jsonb,
          $9,
          null,
          $10
        )
        returning *
      `, [
                name,
                organizationType,
                officialEmail,
                officialPhone,
                physicalAddress,
                JSON.stringify(registrationInfo),
                representativeName,
                JSON.stringify(representativeContact),
                intendedOperatingJurisdiction,
                userId,
            ]);
            const organization = orgResult.rows[0];
            const membershipResult = await client.query(`
        insert into organization_members (
          organization_id,
          user_id,
          role_code,
          status,
          invited_by_user_id,
          invitation_channel,
          permissions,
          joined_at
        )
        values ($1, $2, 'OWNER', 'ACTIVE', $2, 'registration', '{}'::jsonb, now())
        returning *
      `, [organization.id, userId]);
            const membership = membershipResult.rows[0];
            const normalizedLocations = locations
                .map((location) => this.normalizeLocationInput(location))
                .filter(Boolean);
            const storedLocations = [];
            for (const location of normalizedLocations) {
                const locationResult = await client.query(`
          insert into organization_locations (
            organization_id,
            name,
            location_type,
            center_lat,
            center_lng,
            boundary_geojson,
            active
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, $7)
          returning *
        `, [
                    organization.id,
                    location.name,
                    location.locationType,
                    location.centerLat,
                    location.centerLng,
                    JSON.stringify(location.boundaryGeojson || null),
                    location.active,
                ]);
                storedLocations.push(mapLocationRow(locationResult.rows[0]));
            }
            await client.query(`
        insert into organization_audit_logs (
          organization_id,
          actor_user_id,
          action,
          target_type,
          target_id,
          metadata
        )
        values ($1, $2, 'organization_registered', 'organization', $1, $3::jsonb)
      `, [organization.id, userId, JSON.stringify({
                    organizationType,
                    locationCount: storedLocations.length,
                    status: organization.status,
                })]);
            return {
                organization: mapOrganizationRow(organization),
                membership: mapMembershipRow({
                    ...membership,
                    membership_id: membership.id,
                    membership_status: membership.status,
                    membership_permissions: membership.permissions,
                    membership_created_at: membership.created_at,
                    membership_updated_at: membership.updated_at,
                }),
                locations: storedLocations,
            };
        });
    }
    async listMine(userId) {
        const result = await this.db.query(`
      select
        o.*,
        m.id as membership_id,
        m.user_id,
        m.role_code,
        m.status as membership_status,
        m.permissions as membership_permissions,
        m.invited_by_user_id,
        m.invitation_channel,
        m.joined_at,
        m.suspended_at,
        m.removed_at,
        m.created_at as membership_created_at,
        m.updated_at as membership_updated_at
      from organization_members m
      join organizations o on o.id = m.organization_id
      where m.user_id = $1 and m.status <> 'REMOVED'
      order by o.created_at desc
    `, [userId]);
        return this.hydrateOrganizations(result.rows);
    }
    async getById(userId, organizationId) {
        const result = await this.db.query(`
      select
        o.*,
        m.id as membership_id,
        m.user_id,
        m.role_code,
        m.status as membership_status,
        m.permissions as membership_permissions,
        m.invited_by_user_id,
        m.invitation_channel,
        m.joined_at,
        m.suspended_at,
        m.removed_at,
        m.created_at as membership_created_at,
        m.updated_at as membership_updated_at
      from organizations o
      left join organization_members m on m.organization_id = o.id and m.user_id = $1
      where o.id = $2
      limit 1
    `, [userId, organizationId]);
        const row = result.rows[0];
        if (!row || !row.membership_id) {
            throw new common_1.NotFoundException('Organization not found');
        }
        return this.hydrateOrganizations([row]).then((rows) => rows[0]);
    }
    async listMembers(userId, organizationId) {
        const membership = await this.requireMembership(userId, organizationId, 'manage_members');
        const result = await this.db.query(`
      select
        m.*,
        u.email as member_email,
        u.phone_e164 as member_phone,
        u.name as member_name,
        u.status as member_account_status
      from organization_members m
      left join users u on u.id = m.user_id
      where m.organization_id = $1
      order by
        case m.role_code
          when 'OWNER' then 1
          when 'ADMIN' then 2
          when 'SAFETY_OFFICER' then 3
          when 'VIEWER' then 4
          else 5
        end,
        m.created_at asc
    `, [organizationId]);
        return {
            organizationId,
            requestedBy: this.mapMembershipForResponse(membership),
            members: result.rows.map((row) => ({
                id: row.id,
                userId: row.user_id,
                name: row.member_name || null,
                email: row.member_email || null,
                phone: row.member_phone || null,
                roleCode: row.role_code,
                status: row.status,
                permissions: buildPermissionMap(row.role_code, row.permissions),
                invitedByUserId: row.invited_by_user_id || null,
                invitationChannel: row.invitation_channel || null,
                joinedAt: row.joined_at || null,
                suspendedAt: row.suspended_at || null,
                removedAt: row.removed_at || null,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            })),
        };
    }
    async createInvitation(userId, organizationId, body) {
        await this.requireMembership(userId, organizationId, 'manage_members');
        const inviteeEmail = normalizeEmail(body?.inviteeEmail);
        const inviteePhone = normalizePhone(body?.inviteePhone);
        const channel = normalizeText(body?.invitationChannel || (inviteePhone ? 'sms' : 'email'), 32).toLowerCase() || 'email';
        const expiresInDays = Math.max(1, Number(body?.expiresInDays || 14));
        if (!inviteeEmail && !inviteePhone && !body?.inviteeUserId) {
            throw new common_1.BadRequestException('invitee email, phone, or user id is required');
        }
        const inviteToken = crypto.randomBytes(24).toString('hex');
        const tokenHash = sha256Hex(inviteToken);
        const inviteeUserId = normalizeText(body?.inviteeUserId, 80) || null;
        const result = await this.db.query(`
      insert into organization_invitations (
        organization_id,
        invited_by_user_id,
        invitee_user_id,
        invitee_email,
        invitee_phone,
        invite_token_hash,
        invitation_channel,
        status,
        expires_at
      )
      values ($1, $2, $3, nullif($4, ''), nullif($5, ''), $6, $7, 'INVITED', now() + ($8::int * interval '1 day'))
      returning *
    `, [
            organizationId,
            userId,
            inviteeUserId,
            inviteeEmail,
            inviteePhone,
            tokenHash,
            channel,
            expiresInDays,
        ]);
        await this.recordAudit(organizationId, userId, 'invitation_created', 'organization_invitation', result.rows[0].id, {
            channel,
            expiresInDays,
        });
        return {
            invitation: mapInvitationRow({
                ...result.rows[0],
                invite_token: inviteToken,
            }, true),
        };
    }
    async acceptInvitation(userId, tokenValue) {
        const token = normalizeText(tokenValue, 256);
        if (!token) {
            throw new common_1.BadRequestException('invitation token is required');
        }
        const tokenHash = sha256Hex(token);
        const result = await this.db.transaction(async (client) => {
            const invitationResult = await client.query(`
        select *
        from organization_invitations
        where invite_token_hash = $1
        limit 1
      `, [tokenHash]);
            const invitation = invitationResult.rows[0];
            if (!invitation) {
                throw new common_1.NotFoundException('Invitation not found');
            }
            if (invitation.status !== 'INVITED') {
                throw new common_1.BadRequestException('Invitation is no longer active');
            }
            if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
                await client.query(`update organization_invitations set status = 'EXPIRED', updated_at = now() where id = $1`, [invitation.id]);
                throw new common_1.BadRequestException('Invitation has expired');
            }
            const userResult = await client.query('select id, email, phone_e164 from users where id = $1 limit 1', [userId]);
            const user = userResult.rows[0];
            if (!user) {
                throw new common_1.NotFoundException('User not found');
            }
            if (invitation.invitee_user_id && invitation.invitee_user_id !== userId) {
                throw new common_1.ForbiddenException('This invitation was issued to a different user');
            }
            if (invitation.invitee_email && normalizeEmail(invitation.invitee_email) !== normalizeEmail(user.email)) {
                throw new common_1.ForbiddenException('This invitation was issued to a different email address');
            }
            if (invitation.invitee_phone && normalizePhone(invitation.invitee_phone) !== normalizePhone(user.phone_e164)) {
                throw new common_1.ForbiddenException('This invitation was issued to a different phone number');
            }
            const updatedInvitationResult = await client.query(`
        update organization_invitations
        set
          invitee_user_id = coalesce(invitee_user_id, $2),
          status = 'ACCEPTED',
          accepted_at = now(),
          updated_at = now()
        where id = $1
        returning *
      `, [invitation.id, userId]);
            const membershipResult = await client.query(`
        insert into organization_members (
          organization_id,
          user_id,
          role_code,
          status,
          invited_by_user_id,
          invitation_channel,
          permissions,
          joined_at,
          updated_at
        )
        values ($1, $2, 'MEMBER', 'ACTIVE', $3, $4, '{}'::jsonb, now(), now())
        on conflict (organization_id, user_id)
        do update set
          status = 'ACTIVE',
          role_code = coalesce(organization_members.role_code, 'MEMBER'),
          invitation_channel = excluded.invitation_channel,
          removed_at = null,
          suspended_at = null,
          joined_at = coalesce(organization_members.joined_at, now()),
          updated_at = now()
        returning *
      `, [
                invitation.organization_id,
                userId,
                invitation.invited_by_user_id || null,
                invitation.invitation_channel || 'email',
            ]);
            await client.query(`
        insert into organization_audit_logs (
          organization_id,
          actor_user_id,
          action,
          target_type,
          target_id,
          metadata
        )
        values ($1, $2, 'invitation_accepted', 'organization_invitation', $3, $4::jsonb)
      `, [
                invitation.organization_id,
                userId,
                invitation.id,
                JSON.stringify({
                    invitationChannel: invitation.invitation_channel || 'email',
                }),
            ]);
            return {
                invitation: mapInvitationRow(updatedInvitationResult.rows[0]),
                membership: mapMembershipRow({
                    ...membershipResult.rows[0],
                    membership_id: membershipResult.rows[0].id,
                    membership_status: membershipResult.rows[0].status,
                    membership_permissions: membershipResult.rows[0].permissions,
                    membership_created_at: membershipResult.rows[0].created_at,
                    membership_updated_at: membershipResult.rows[0].updated_at,
                }),
            };
        });
        return this.getById(userId, result.membership.organizationId).then((organization) => ({
            organization,
            invitation: result.invitation,
            membership: result.membership,
        }));
    }
    async upsertLocation(userId, organizationId, body, locationId = null) {
        await this.requireMembership(userId, organizationId, 'manage_locations');
        const name = normalizeText(body?.name, 180);
        const locationType = normalizeText(body?.locationType || 'general', 64) || 'general';
        const hasCenterLat = body?.centerLat !== undefined && body?.centerLat !== null;
        const hasCenterLng = body?.centerLng !== undefined && body?.centerLng !== null;
        const boundaryGeojson = body?.boundaryGeojson ? safeJsonObject(body.boundaryGeojson, null) : null;
        if (!name) {
            throw new common_1.BadRequestException('location name is required');
        }
        if (hasCenterLat !== hasCenterLng) {
            throw new common_1.BadRequestException('centerLat and centerLng must be provided together');
        }
        const centerLat = hasCenterLat ? Number(body.centerLat) : null;
        const centerLng = hasCenterLng ? Number(body.centerLng) : null;
        if (hasCenterLat && (!Number.isFinite(centerLat) || centerLat < -90 || centerLat > 90)) {
            throw new common_1.BadRequestException('centerLat must be between -90 and 90');
        }
        if (hasCenterLng && (!Number.isFinite(centerLng) || centerLng < -180 || centerLng > 180)) {
            throw new common_1.BadRequestException('centerLng must be between -180 and 180');
        }
        const active = body?.active === undefined ? true : Boolean(body.active);
        if (locationId) {
            const result = await this.db.query(`
        update organization_locations
        set
          name = $3,
          location_type = $4,
          center_lat = $5,
          center_lng = $6,
          boundary_geojson = $7::jsonb,
          active = $8,
          updated_at = now()
        where id = $1 and organization_id = $2
        returning *
      `, [
                locationId,
                organizationId,
                name,
                locationType,
                centerLat,
                centerLng,
                JSON.stringify(boundaryGeojson),
                active,
            ]);
            const row = result.rows[0];
            if (!row) {
                throw new common_1.NotFoundException('Location not found');
            }
            await this.recordAudit(organizationId, userId, 'location_updated', 'organization_location', row.id, {
                name,
                locationType,
                active,
            });
            return { location: mapLocationRow(row) };
        }
        const result = await this.db.query(`
      insert into organization_locations (
        organization_id,
        name,
        location_type,
        center_lat,
        center_lng,
        boundary_geojson,
        active
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7)
      returning *
    `, [
            organizationId,
            name,
            locationType,
            centerLat,
            centerLng,
            JSON.stringify(boundaryGeojson),
            active,
        ]);
        await this.recordAudit(organizationId, userId, 'location_created', 'organization_location', result.rows[0].id, {
            name,
            locationType,
            active,
        });
        return { location: mapLocationRow(result.rows[0]) };
    }
    async createBroadcast(userId, organizationId, body) {
        const membership = await this.requireMembership(userId, organizationId, 'send_broadcasts');
        const title = normalizeText(body?.title, 160);
        const description = normalizeText(body?.description, 2000);
        if (!title) {
            throw new common_1.BadRequestException('title is required');
        }
        const priorityScore = calculateAlertPriority({
            severity: body?.severity || 'medium',
            geographicWeight: 1,
            jurisdictionWeight: 1.1,
            organizationWeight: 1.4,
            userContextWeight: 1,
        });
        const dedupeKey = normalizeText(body?.dedupeKey, 256) || buildDedupeKey({
            alertType: 'ORGANIZATION_BROADCAST',
            severity: body?.severity || 'medium',
            lat: body?.lat ?? null,
            lng: body?.lng ?? null,
            organizationIds: [organizationId],
            title,
        });
        return this.db.transaction(async (client) => {
            const alertResult = await client.query(`
        insert into organization_alerts (
          organization_id,
          alert_type,
          delivery_scope,
          priority_score,
          dedupe_key,
          payload
        )
        values ($1, 'ORGANIZATION_BROADCAST', 'members', $2, $3, $4::jsonb)
        returning *
      `, [
                organizationId,
                priorityScore,
                dedupeKey,
                JSON.stringify({
                    title,
                    description,
                    severity: normalizeSeverity(body?.severity || 'medium'),
                    createdByUserId: userId,
                    membershipRole: membership.roleCode,
                }),
            ]);
            const recipientsResult = await client.query(`
        select user_id
        from organization_members
        where organization_id = $1 and status = 'ACTIVE'
      `, [organizationId]);
            let deliveries = 0;
            for (const row of recipientsResult.rows) {
                await client.query(`
          insert into alert_deliveries (
            organization_alert_id,
            recipient_user_id,
            delivery_channel,
            delivery_status,
            dedupe_key,
            payload
          )
          values ($1, $2, 'in_app', 'queued', $3, $4::jsonb)
        `, [
                    alertResult.rows[0].id,
                    row.user_id,
                    `${dedupeKey}:${row.user_id}`,
                    JSON.stringify({
                        audience: 'organization_member',
                        organizationId,
                        title,
                    }),
                ]);
                deliveries += 1;
            }
            await this.recordAudit(organizationId, userId, 'broadcast_created', 'organization_alert', alertResult.rows[0].id, {
                recipientCount: deliveries,
            });
            return {
                alert: {
                    id: alertResult.rows[0].id,
                    organizationId,
                    alertType: alertResult.rows[0].alert_type,
                    deliveryScope: alertResult.rows[0].delivery_scope,
                    priorityScore: Number(alertResult.rows[0].priority_score),
                    dedupeKey: alertResult.rows[0].dedupe_key,
                    payload: safeJsonObject(alertResult.rows[0].payload, {}),
                    createdAt: alertResult.rows[0].created_at,
                },
                recipientCount: deliveries,
            };
        });
    }
    async previewRouting(userId, body) {
        const severity = normalizeSeverity(body?.severity || 'medium');
        const lat = Number(body?.lat);
        const lng = Number(body?.lng);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            throw new common_1.BadRequestException('lat must be between -90 and 90');
        }
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            throw new common_1.BadRequestException('lng must be between -180 and 180');
        }
        const point = { lat, lng };
        const organizationId = normalizeText(body?.organizationId, 80) || null;
        const membershipsResult = organizationId
            ? await this.db.query(`
          select
            m.organization_id,
            m.role_code,
            m.status as membership_status,
            m.permissions as membership_permissions,
            o.name,
            o.status as organization_status,
            o.intended_operating_jurisdiction
          from organization_members m
          join organizations o on o.id = m.organization_id
          where m.user_id = $1
            and m.organization_id = $2
            and m.status = 'ACTIVE'
            and o.status <> 'REJECTED'
        `, [userId, organizationId])
            : await this.db.query(`
          select
            m.organization_id,
            m.role_code,
            m.status as membership_status,
            m.permissions as membership_permissions,
            o.name,
            o.status as organization_status,
            o.intended_operating_jurisdiction
          from organization_members m
          join organizations o on o.id = m.organization_id
          where m.user_id = $1
            and m.status = 'ACTIVE'
            and o.status <> 'REJECTED'
          order by o.created_at desc
        `, [userId]);
        const orgIds = membershipsResult.rows.map((row) => row.organization_id);
        const locations = orgIds.length > 0
            ? await this.db.query(`
          select *
          from organization_locations
          where organization_id = any($1::uuid[]) and active = true
        `, [orgIds])
            : { rows: [] };
        const jurisdictions = orgIds.length > 0
            ? await this.db.query(`
          select *
          from organization_jurisdictions
          where organization_id = any($1::uuid[]) and active = true
        `, [orgIds])
            : { rows: [] };
        const locationsByOrg = new Map();
        const jurisdictionsByOrg = new Map();
        for (const location of locations.rows) {
            const list = locationsByOrg.get(location.organization_id) || [];
            list.push(mapLocationRow(location));
            locationsByOrg.set(location.organization_id, list);
        }
        for (const jurisdiction of jurisdictions.rows) {
            const list = jurisdictionsByOrg.get(jurisdiction.organization_id) || [];
            list.push(mapJurisdictionRow(jurisdiction));
            jurisdictionsByOrg.set(jurisdiction.organization_id, list);
        }
        const candidateOrganizations = [];
        let bestLocalMatch = null;
        for (const row of membershipsResult.rows) {
            const orgLocations = locationsByOrg.get(row.organization_id) || [];
            const orgJurisdictions = jurisdictionsByOrg.get(row.organization_id) || [];
            const locationMatch = orgLocations.reduce((best, location) => {
                const match = evaluateGeographicMatch(point, {
                    centerLat: location.centerLat,
                    centerLng: location.centerLng,
                    boundaryGeojson: location.boundaryGeojson,
                    radiusM: location.radiusM,
                });
                if (!best || (match.matched && !best.matched) || (match.distanceMeters != null && best.distanceMeters != null && match.distanceMeters < best.distanceMeters)) {
                    return match;
                }
                return best;
            }, null);
            const jurisdictionMatch = orgJurisdictions.reduce((best, jurisdiction) => {
                const match = evaluateGeographicMatch(point, {
                    centerLat: jurisdiction.centerLat,
                    centerLng: jurisdiction.centerLng,
                    boundaryGeojson: jurisdiction.boundaryGeojson,
                    radiusM: jurisdiction.radiusM,
                });
                if (!best || (match.matched && !best.matched) || (match.distanceMeters != null && best.distanceMeters != null && match.distanceMeters < best.distanceMeters)) {
                    return match;
                }
                return best;
            }, null);
            const geographicWeight = Math.max(deriveGeographicWeight(locationMatch), deriveGeographicWeight(jurisdictionMatch));
            const organizationWeight = row.role_code === 'OWNER' || row.role_code === 'ADMIN' ? 1.2 : 1.05;
            const jurisdictionWeight = jurisdictionMatch && jurisdictionMatch.matched ? 1.25 : 1;
            const priorityScore = calculateAlertPriority({
                severity,
                geographicWeight,
                jurisdictionWeight,
                organizationWeight,
                userContextWeight: 1,
            });
            const route = {
                organizationId: row.organization_id,
                name: row.name,
                roleCode: row.role_code,
                membershipStatus: row.membership_status,
                organizationStatus: row.organization_status,
                intendedOperatingJurisdiction: row.intended_operating_jurisdiction || null,
                geographicMatch: locationMatch && locationMatch.matched ? locationMatch : jurisdictionMatch,
                jurisdictionMatch,
                priorityScore,
                recipientWeight: buildPermissionMap(row.role_code, row.membership_permissions),
                alertTypes: [
                    locationMatch && locationMatch.matched ? 'LOCAL_EMERGENCY' : null,
                    jurisdictionMatch && jurisdictionMatch.matched ? 'ORGANIZATION_INCIDENT' : null,
                ].filter(Boolean),
            };
            if (!bestLocalMatch || route.priorityScore > bestLocalMatch.priorityScore) {
                bestLocalMatch = route;
            }
            candidateOrganizations.push(route);
        }
        const dedupeKey = buildDedupeKey({
            alertType: 'LOCAL_EMERGENCY',
            severity,
            lat,
            lng,
            organizationIds: candidateOrganizations.map((item) => item.organizationId),
            title: body?.title || 'incident',
        });
        return {
            incident: {
                severity,
                lat,
                lng,
                locationAccuracyM: body?.locationAccuracyM == null ? null : Number(body.locationAccuracyM),
                organizationId,
            },
            dedupeKey,
            bestMatch: bestLocalMatch,
            organizations: candidateOrganizations.sort((left, right) => right.priorityScore - left.priorityScore),
        };
    }
    async requireMembership(userId, organizationId, permission) {
        const result = await this.db.query(`
      select
        m.id as membership_id,
        m.user_id,
        m.organization_id,
        m.role_code,
        m.status as membership_status,
        m.permissions as membership_permissions,
        m.invited_by_user_id,
        m.invitation_channel,
        m.joined_at,
        m.suspended_at,
        m.removed_at,
        m.created_at as membership_created_at,
        m.updated_at as membership_updated_at,
        o.id,
        o.name,
        o.organization_type,
        o.status,
        o.official_email,
        o.official_phone,
        o.physical_address,
        o.registration_info,
        o.representative_name,
        o.representative_contact,
        o.intended_operating_jurisdiction,
        o.verified_at,
        o.created_by_user_id,
        o.created_at,
        o.updated_at
      from organizations o
      join organization_members m on m.organization_id = o.id
      where o.id = $1 and m.user_id = $2
      limit 1
    `, [organizationId, userId]);
        const row = result.rows[0];
        if (!row || row.membership_status === 'REMOVED') {
            throw new common_1.NotFoundException('Organization not found');
        }
        if (row.membership_status !== 'ACTIVE') {
            throw new common_1.ForbiddenException('Organization membership is not active');
        }
        const membership = mapMembershipRow(row);
        if (permission && !hasPermission(membership, permission)) {
            throw new common_1.ForbiddenException('You do not have permission to manage this organization');
        }
        return membership;
    }
    async recordAudit(organizationId, actorUserId, action, targetType, targetId, metadata) {
        await this.db.query(`
      insert into organization_audit_logs (
        organization_id,
        actor_user_id,
        action,
        target_type,
        target_id,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6::jsonb)
    `, [
            organizationId,
            actorUserId || null,
            action,
            targetType || null,
            targetId || null,
            JSON.stringify(metadata || {}),
        ]);
    }
    normalizeLocationInput(location) {
        if (!location || typeof location !== 'object') {
            return null;
        }
        const name = normalizeText(location.name, 180);
        if (!name) {
            return null;
        }
        const locationType = normalizeText(location.locationType || 'general', 64) || 'general';
        const hasCenterLat = location.centerLat !== undefined && location.centerLat !== null;
        const hasCenterLng = location.centerLng !== undefined && location.centerLng !== null;
        if (hasCenterLat !== hasCenterLng) {
            return null;
        }
        const centerLat = hasCenterLat ? Number(location.centerLat) : null;
        const centerLng = hasCenterLng ? Number(location.centerLng) : null;
        if (hasCenterLat && (!Number.isFinite(centerLat) || !Number.isFinite(centerLng))) {
            return null;
        }
        const boundaryGeojson = location.boundaryGeojson ? safeJsonObject(location.boundaryGeojson, null) : null;
        return {
            name,
            locationType,
            centerLat,
            centerLng,
            boundaryGeojson,
            active: location.active === undefined ? true : Boolean(location.active),
        };
    }
    mapMembershipForResponse(membership) {
        return {
            ...membership,
            permissions: buildPermissionMap(membership.roleCode, membership.permissions),
        };
    }
    async hydrateOrganizations(rows) {
        if (rows.length === 0) {
            return [];
        }
        const organizationIds = rows.map((row) => row.id);
        const [locations, jurisdictions, invitations] = await Promise.all([
            this.db.query(`
        select *
        from organization_locations
        where organization_id = any($1::uuid[])
        order by created_at asc
      `, [organizationIds]),
            this.db.query(`
        select *
        from organization_jurisdictions
        where organization_id = any($1::uuid[])
        order by created_at asc
      `, [organizationIds]),
            this.db.query(`
        select *
        from organization_invitations
        where organization_id = any($1::uuid[])
        order by created_at desc
      `, [organizationIds]),
        ]);
        const locationsByOrg = new Map();
        const jurisdictionsByOrg = new Map();
        const invitationsByOrg = new Map();
        for (const location of locations.rows) {
            const list = locationsByOrg.get(location.organization_id) || [];
            list.push(mapLocationRow(location));
            locationsByOrg.set(location.organization_id, list);
        }
        for (const jurisdiction of jurisdictions.rows) {
            const list = jurisdictionsByOrg.get(jurisdiction.organization_id) || [];
            list.push(mapJurisdictionRow(jurisdiction));
            jurisdictionsByOrg.set(jurisdiction.organization_id, list);
        }
        for (const invitation of invitations.rows) {
            const list = invitationsByOrg.get(invitation.organization_id) || [];
            list.push(mapInvitationRow(invitation));
            invitationsByOrg.set(invitation.organization_id, list);
        }
        return rows.map((row) => {
            const organization = mapOrganizationRow(row);
            const membership = this.mapMembershipForResponse(mapMembershipRow(row));
            return {
                organization,
                membership,
                permissions: membership.permissions,
                locations: locationsByOrg.get(row.id) || [],
                jurisdictions: jurisdictionsByOrg.get(row.id) || [],
                invitations: invitationsByOrg.get(row.id) || [],
            };
        });
    }
};
exports.OrganizationsService = OrganizationsService;
exports.OrganizationsService = OrganizationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_service_1.DbService])
], OrganizationsService);
