# API Routes

Base URL: `/api`

## Auth
- `POST /auth/otp/request`
- `POST /auth/otp/verify`
- `POST /auth/refresh`

## Users
- `GET /users/me`
- `PATCH /users/me`
  - Response now includes `credibility`, `roles`, and `reviewerRequest`.

## Roles
- `GET /roles`
- `GET /roles/me`
- `GET /roles/reviewer-request/me`
- `POST /roles/reviewer-request`
  - Used by normal users to ask for reviewer access from the profile tab.
- `GET /roles/reviewer-requests` (admin only)
- `POST /roles/reviewer-requests/:id/resolve` (admin only)
  - `status` must be `approved` or `rejected`.
  - Only `reviewer` can be granted through the API.
  - `admin` must be assigned directly in the database / Supabase tables.

## Contacts
- `GET /contacts`
- `POST /contacts`
- `PATCH /contacts/:id`
- `DELETE /contacts/:id`

## Alerts & Sessions
- `POST /alerts` (rate limit: 5/hour)
  - Supports `triggerSource`, `stage`, `riskScore`, `riskSnapshot`, `detectionSummary`, and `cancelWindowSeconds`.
  - Stage tiers: `monitoring`, `suspicious`, `soft_alert`, `high_alert`, `critical`
- `POST /alerts/:id/cancel`
- `POST /alerts/:id/escalate`
  - Supports `stage`, `riskScore`, `riskSnapshot`, and `detectionSummary`.
- `GET /sessions/active`
- `GET /sessions/:id`
- `POST /sessions/:id/close`

## Locations
- `POST /sessions/:sessionId/locations` (batch)
- `GET /sessions/:sessionId/locations`

## Organizations
- `POST /organizations/register`
  - Creates a verified-user-owned organization workspace without creating a second Sentinel account.
- `GET /organizations`
  - Lists the authenticated user's active and pending organization memberships.
- `GET /organizations/:id`
- `GET /organizations/:id/members`
- `POST /organizations/:id/invitations`
- `POST /organizations/invitations/:token/accept`
- `POST /organizations/:id/locations`
- `PATCH /organizations/:id/locations/:locationId`
- `POST /organizations/:id/broadcasts`
  - Creates an organization-wide broadcast and fans it out to active members.
- `POST /organizations/routing/preview`
  - Returns a routing preview for an incident using severity, geography, jurisdiction, and organization relevance.

## Reports
- `GET /reports`
- `POST /reports`
  - Supports `category`, `severity`, `lat`, `lng`, `locationAccuracyM`, `media`, `aiConfidence`, and `confirmedSeverity`.
  - Severity tiers: `critical`, `high`, `medium`, `low`
  - Category tags: `crime`, `fire`, `medical`, `traffic`, `environment`, `suspicious_activity`
  - Reports now carry `distribution` and `classification` metadata in responses.
  - Classification states: `confirmed_true`, `likely_true`, `inconclusive`, `false`, `malicious`

## Notifications
- `GET /notifications`

## Subscriptions
- `GET /subscriptions`
- `POST /subscriptions/sync`
  - Refreshes the authenticated user's server-side subscription record. Include `reference` to verify a Paystack payment.
- `POST /subscriptions/checkout`
  - Initializes a Paystack checkout for a paid plan. Body: `{ "planId": "basic" | "silver" | "family" | "gold" | "pro" | "platinum" | "enterprise" }`.

## Telemetry
- `POST /telemetry`

## Risk Zones
- `GET /risk-zones`
- `GET /risk-zones/geography`
  - Returns Nigeria's hierarchy of geopolitical zones, states, Sentinel operational zones, and response grids.

## Admin
- `GET /admin/reports`
  - Reviewer/admin moderation queue. Supports `filter=pending|reviewed|flagged|all`.
- `GET /admin/active-alerts`
- `POST /admin/alerts/:id/flag`
- `POST /admin/reports/:id/classify`
  - Body can include `classification`, `responseOutcome`, `qualityScore`, `corroborationCount`, `aiConfidence`, and `notes`.
