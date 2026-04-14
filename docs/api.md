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
- `POST /subscriptions/checkout`

## Telemetry
- `POST /telemetry`

## Risk Zones
- `GET /risk-zones`

## Admin
- `GET /admin/active-alerts`
- `POST /admin/alerts/:id/flag`
- `POST /admin/reports/:id/classify`
  - Body can include `classification`, `responseOutcome`, `qualityScore`, `corroborationCount`, `aiConfidence`, and `notes`.
