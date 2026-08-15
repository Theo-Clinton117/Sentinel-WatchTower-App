import { apiGet, apiPost } from './api';

export type OrganizationStatus =
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'SUSPENDED'
  | 'REJECTED';

export type OrganizationRoleCode =
  | 'OWNER'
  | 'ADMIN'
  | 'SAFETY_OFFICER'
  | 'VIEWER'
  | 'MEMBER';

export type OrganizationPermissionCode =
  | 'manage_organization'
  | 'manage_administrators'
  | 'manage_members'
  | 'manage_locations'
  | 'manage_jurisdictions'
  | 'manage_billing'
  | 'view_authorized_incidents'
  | 'view_incident_history'
  | 'send_broadcasts'
  | 'access_emergency_info'
  | 'receive_critical_alerts'
  | 'view_safety_info'
  | 'receive_relevant_alerts'
  | 'use_normal_sentinel'
  | 'view_member_location';

export type OrganizationRecord = {
  id: string;
  name: string;
  organizationType: string;
  status: OrganizationStatus;
  officialEmail?: string | null;
  officialPhone?: string | null;
  physicalAddress?: string | null;
  registrationInfo?: Record<string, unknown>;
  representativeName?: string | null;
  representativeContact?: Record<string, unknown>;
  intendedOperatingJurisdiction?: string | null;
  verifiedAt?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type OrganizationMembership = {
  id: string;
  organizationId: string;
  userId: string;
  roleCode: OrganizationRoleCode;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  permissions: Partial<Record<OrganizationPermissionCode, boolean>>;
  invitedByUserId?: string | null;
  invitationChannel?: string | null;
  joinedAt?: string | null;
  suspendedAt?: string | null;
  removedAt?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
};

export type OrganizationLocation = {
  id: string;
  organizationId: string;
  name: string;
  locationType: string;
  centerLat?: number | null;
  centerLng?: number | null;
  boundaryGeojson?: Record<string, unknown> | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

export type OrganizationJurisdiction = {
  id: string;
  organizationId: string;
  name: string;
  jurisdictionType: string;
  boundaryGeojson?: Record<string, unknown> | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

export type OrganizationInvitation = {
  id: string;
  organizationId: string;
  invitedByUserId?: string | null;
  inviteeUserId?: string | null;
  inviteeEmail?: string | null;
  inviteePhone?: string | null;
  invitationChannel: string;
  status: 'INVITED' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  inviteToken?: string;
};

export type OrganizationMember = {
  id: string;
  userId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  roleCode: OrganizationRoleCode;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  permissions: Partial<Record<OrganizationPermissionCode, boolean>>;
  invitedByUserId?: string | null;
  invitationChannel?: string | null;
  joinedAt?: string | null;
  suspendedAt?: string | null;
  removedAt?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
};

export type OrganizationWorkspace = {
  organization: OrganizationRecord;
  membership: OrganizationMembership;
  permissions: Partial<Record<OrganizationPermissionCode, boolean>>;
  locations: OrganizationLocation[];
  jurisdictions: OrganizationJurisdiction[];
  invitations: OrganizationInvitation[];
};

export type OrganizationMembersResponse = {
  organizationId: string;
  requestedBy: OrganizationMembership;
  members: OrganizationMember[];
};

export type OrganizationRegistrationPayload = {
  name: string;
  organizationType: string;
  officialEmail: string;
  officialPhone: string;
  physicalAddress: string;
  registrationInfo?: Record<string, unknown>;
  representativeName: string;
  representativeContact?: Record<string, unknown>;
  intendedOperatingJurisdiction: string;
  registeredLocations?: Array<{
    name: string;
    locationType?: string;
    centerLat?: number | null;
    centerLng?: number | null;
    boundaryGeojson?: Record<string, unknown> | null;
    active?: boolean;
  }>;
};

export type OrganizationInvitationPayload = {
  inviteeEmail?: string;
  inviteePhone?: string;
  inviteeUserId?: string;
  invitationChannel?: string;
  expiresInDays?: number;
};

export type OrganizationLocationPayload = {
  name: string;
  locationType?: string;
  centerLat?: number | null;
  centerLng?: number | null;
  boundaryGeojson?: Record<string, unknown> | null;
  active?: boolean;
};

export type OrganizationRoutingPreviewPayload = {
  severity?: 'low' | 'medium' | 'high' | 'critical';
  lat: number;
  lng: number;
  locationAccuracyM?: number | null;
  organizationId?: string | null;
  title?: string;
};

export type OrganizationRoutingPreviewResponse = {
  incident: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    lat: number;
    lng: number;
    locationAccuracyM?: number | null;
    organizationId?: string | null;
  };
  dedupeKey: string;
  bestMatch?: {
    organizationId: string;
    name: string;
    roleCode: OrganizationRoleCode;
    membershipStatus: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
    organizationStatus: OrganizationStatus;
    intendedOperatingJurisdiction?: string | null;
    geographicMatch?: {
      matched: boolean;
      source: string;
      distanceMeters?: number | null;
    } | null;
    jurisdictionMatch?: {
      matched: boolean;
      source: string;
      distanceMeters?: number | null;
    } | null;
    priorityScore: number;
    recipientWeight: Partial<Record<OrganizationPermissionCode, boolean>>;
    alertTypes: string[];
  } | null;
  organizations: Array<{
    organizationId: string;
    name: string;
    roleCode: OrganizationRoleCode;
    membershipStatus: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
    organizationStatus: OrganizationStatus;
    intendedOperatingJurisdiction?: string | null;
    geographicMatch?: {
      matched: boolean;
      source: string;
      distanceMeters?: number | null;
    } | null;
    jurisdictionMatch?: {
      matched: boolean;
      source: string;
      distanceMeters?: number | null;
    } | null;
    priorityScore: number;
    recipientWeight: Partial<Record<OrganizationPermissionCode, boolean>>;
    alertTypes: string[];
  }>;
};

function normalizeWorkspace(workspace: OrganizationWorkspace): OrganizationWorkspace {
  return workspace;
}

export async function listMyOrganizations(): Promise<OrganizationWorkspace[]> {
  const response = await apiGet<{ organizations: OrganizationWorkspace[] }>('/organizations', {
    auth: true,
  });
  return Array.isArray(response.organizations)
    ? response.organizations.map(normalizeWorkspace)
    : [];
}

export async function registerOrganization(
  payload: OrganizationRegistrationPayload,
): Promise<{
  organization: OrganizationRecord;
  membership: OrganizationMembership;
  locations: OrganizationLocation[];
}> {
  return apiPost<{ organization: OrganizationRecord; membership: OrganizationMembership; locations: OrganizationLocation[] }>(
    '/organizations/register',
    payload,
    { auth: true },
  );
}

export async function listOrganizationMembers(organizationId: string): Promise<OrganizationMembersResponse> {
  return apiGet<OrganizationMembersResponse>(`/organizations/${organizationId}/members`, {
    auth: true,
  });
}

export async function createOrganizationInvitation(
  organizationId: string,
  payload: OrganizationInvitationPayload,
): Promise<{ invitation: OrganizationInvitation }> {
  return apiPost<{ invitation: OrganizationInvitation }>(
    `/organizations/${organizationId}/invitations`,
    payload,
    { auth: true },
  );
}

export async function acceptOrganizationInvitation(
  token: string,
): Promise<{
  organization: OrganizationWorkspace;
  invitation: OrganizationInvitation;
  membership: OrganizationMembership;
}> {
  return apiPost<{
    organization: OrganizationWorkspace;
    invitation: OrganizationInvitation;
    membership: OrganizationMembership;
  }>(`/organizations/invitations/${encodeURIComponent(token)}/accept`, {}, { auth: true });
}

export async function createOrganizationLocation(
  organizationId: string,
  payload: OrganizationLocationPayload,
): Promise<{ location: OrganizationLocation }> {
  return apiPost<{ location: OrganizationLocation }>(
    `/organizations/${organizationId}/locations`,
    payload,
    { auth: true },
  );
}

export async function previewOrganizationRouting(
  payload: OrganizationRoutingPreviewPayload,
): Promise<OrganizationRoutingPreviewResponse> {
  return apiPost<OrganizationRoutingPreviewResponse>('/organizations/routing/preview', payload, {
    auth: true,
  });
}
