# Supabase Table References - Backend Codebase Analysis

## Executive Summary
This document provides a comprehensive mapping of all Supabase table references across the backend codebase (`apps/backend/src/`). It includes locations of SQL queries, service files, and specific operations performed on each table.

---

## Table of Contents
1. [Database Schema Overview](#database-schema-overview)
2. [Table-by-Table Reference List](#table-by-table-reference-list)
3. [Service Files Organization](#service-files-organization)
4. [Database Operations by Type](#database-operations-by-type)
5. [Migration Files](#migration-files)

---

## Database Schema Overview

All tables are PostgreSQL tables managed through Supabase. The schema is versioned through migration files in `db/migrations/`. Row-Level Security (RLS) is enabled on most user-facing tables.

**Core Tables:** 20 main tables + junction/relationship tables
**Connection Method:** Direct PostgreSQL queries via `DbService` (pg library)
**Transaction Support:** Available via `db.transaction()` wrapper

---

## Table-by-Table Reference List

### 1. **users** (Core Identity Table)
**Columns Used:** `id`, `phone_e164`, `name`, `email`, `status`, `created_at`, `updated_at`

**Files Referencing:**
- [auth/auth.service.js](auth/auth.service.js) - User creation/verification during signup/login
- [users/users.service.js](users/users.service.js) - Get user profile and update (name, email)
- [contacts/contacts.service.js](contacts/contacts.service.js) - Join with trusted_contacts for contact matching
- [alerts/alerts.service.js](alerts/alerts.service.js) - Get user for alert context
- [admin/admin.service.js](admin/admin.service.js) - Admin queries for user information in reports
- [roles/roles.logic.js](roles/roles.logic.js) - User role queries
- [subscriptions/subscriptions.service.js](subscriptions/subscriptions.service.js) - Subscription user lookups

**Operations:**
- SELECT (read profile, check existence)
- INSERT (new user registration)
- UPDATE (profile name/email updates)
- JOIN (with other tables for enrichment)

**Key Constraints:**
```sql
-- Email uniqueness (case-insensitive where email provided)
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email)) WHERE email IS NOT NULL;

-- Phone uniqueness
UNIQUE phone_e164

-- Identity check
CONSTRAINT users_contact_identity_check CHECK (phone_e164 IS NOT NULL OR email IS NOT NULL)
```

---

### 2. **user_devices** (Mobile Device Registry)
**Columns Used:** `id`, `user_id`, `device_id`, `platform`, `fcm_token`, `last_seen_at`, `created_at`

**Files Referencing:**
- [auth/auth.service.js](auth/auth.service.js) - Register devices on login
- May be used in notification routing (referenced in schema)

**Operations:**
- INSERT (register new device)
- UPDATE (update last_seen_at, fcm_token)
- SELECT (lookup user devices)

**Foreign Keys:** `user_id` → `users.id` (cascade delete)

---

### 3. **roles** (Role Definitions)
**Columns Used:** `id`, `name`, `created_at`

**Files Referencing:**
- [roles/roles.service.js](roles/roles.service.js) - List roles, ensure system roles exist
- [roles/roles.logic.js](roles/roles.logic.js) - Ensure system roles created
- [common/guards/roles.guard.js](common/guards/roles.guard.js) - Check user roles
- [auth/auth.service.js](auth/auth.service.js) - Assign roles on signup

**Operations:**
- SELECT (list all roles, get role by name)
- INSERT (create system roles: 'user', 'reviewer', 'admin')
  ```sql
  INSERT INTO roles (name) VALUES ('user'), ('reviewer'), ('admin')
  ON CONFLICT (name) DO NOTHING
  ```

**System Roles:**
- `user` (default, all users)
- `reviewer` (can review reports)
- `admin` (full access)

---

### 4. **user_roles** (User-Role Junction)
**Columns Used:** `user_id`, `role_id`, `created_at`

**Files Referencing:**
- [roles/roles.service.js](roles/roles.service.js) - List users per role
- [roles/roles.logic.js](roles/roles.logic.js) - Get user roles, assign default role
- [common/guards/roles.guard.js](common/guards/roles.guard.js) - Verify user has required role
- [auth/auth.service.js](auth/auth.service.js) - Assign initial role on signup

**Operations:**
- SELECT (get all roles for a user)
- INSERT (assign role to user)
  ```sql
  INSERT INTO user_roles (user_id, role_id)
  SELECT $1, r.id FROM roles r WHERE r.name = 'user'
  ON CONFLICT (user_id, role_id) DO NOTHING
  ```
- DELETE (removing roles via cascade)

**Primary Key:** `(user_id, role_id)`

---

### 5. **reviewer_role_requests** (Reviewer Access Requests)
**Columns Used:** `id`, `user_id`, `status`, `motivation`, `admin_note`, `reviewed_by`, `requested_at`, `reviewed_at`, `created_at`, `updated_at`

**Files Referencing:**
- [roles/roles.service.js](roles/roles.service.js) - List pending reviewer requests, approve/reject
- [roles/roles.logic.js](roles/roles.logic.js) - Get latest reviewer request for user
- [users/users.service.js](users/users.service.js) - Include in user profile enrichment
- [auth/auth.service.js](auth/auth.service.js) - Include in auth response

**Operations:**
- SELECT (get pending requests, get user's latest request)
- INSERT (user requests reviewer role)
  ```sql
  INSERT INTO reviewer_role_requests (user_id, motivation, status)
  VALUES ($1, $2, 'pending')
  ```
- UPDATE (admin approves/rejects request)

**Status Values:** `pending`, `approved`, `rejected`, `withdrawn`

**Unique Constraint:**
```sql
CREATE UNIQUE INDEX idx_reviewer_role_requests_pending_user 
ON reviewer_role_requests(user_id) WHERE status = 'pending'
```

---

### 6. **trusted_contacts** (Emergency Contacts)
**Columns Used:** `id`, `user_id`, `contact_user_id`, `contact_name`, `contact_phone`, `contact_email`, `status`, `priority`, `created_at`

**Files Referencing:**
- [contacts/contacts.service.js](contacts/contacts.service.js) - Full CRUD operations
  - List contacts for user
  - Create new contact with trust profile
  - Update contact details
  - Delete contact (cascade deletes trust profile)

**Operations:**
- SELECT (list user's contacts with trust profile permissions)
- INSERT (create new trusted contact + auto-create default trust profile)
- UPDATE (modify contact info, priority)
- DELETE (cascade delete to user_trust_profiles)

**Status Values:** `pending`, `verified`, `blocked`

**Foreign Keys:**
- `user_id` → `users.id` (cascade delete)
- `contact_user_id` → `users.id` (optional, if contact is a Sentinel user)

---

### 7. **user_trust_profiles** (Contact Permission Profiles)
**Columns Used:** `id`, `user_id`, `contact_id`, `can_view_location`, `can_view_history`, `can_sms`, `can_call`, `created_at`

**Files Referencing:**
- [contacts/contacts.service.js](contacts/contacts.service.js) - Create/update trust permissions during contact creation and updates

**Operations:**
- SELECT (read permissions for contact)
- INSERT (create default trust profile when contact created)
  ```sql
  INSERT INTO user_trust_profiles 
    (user_id, contact_id, can_view_location, can_view_history, can_sms, can_call)
  VALUES ($1, $2, true, false, true, true)
  ```
- UPDATE (modify permissions)

**Foreign Keys:**
- `user_id` → `users.id` (cascade delete)
- `contact_id` → `trusted_contacts.id` (cascade delete)

---

### 8. **alerts** (Emergency Alerts)
**Columns Used:** `id`, `user_id`, `status`, `trigger_source`, `stage`, `escalation_level`, `risk_score`, `risk_snapshot`, `detection_summary`, `cancel_expires_at`, `escalated_at`, `created_at`, `resolved_at`

**Files Referencing:**
- [alerts/alerts.service.js](alerts/alerts.service.js) - Complete alert lifecycle
  - Create new alert (panic button, detection)
  - Escalate alert stage
  - Cancel alert
  - Get active alert for user
- [sessions/sessions.service.js](sessions/sessions.service.js) - Get alert data for session
- [admin/admin.service.js](admin/admin.service.js) - List active alerts for monitoring
- [queues/queues.service.js](queues/queues.service.js) - Query alert status for escalation jobs

**Operations:**
- SELECT (get alert by ID and user_id, check status)
- INSERT (create new alert on trigger)
  ```sql
  INSERT INTO alerts (
    user_id, status, trigger_source, stage, escalation_level, 
    risk_score, risk_snapshot, detection_summary, cancel_expires_at
  ) VALUES (...)
  ```
- UPDATE (escalate stage, resolve alert, update risk data)
  ```sql
  UPDATE alerts SET status = 'resolved', resolved_at = now() WHERE id = $1
  UPDATE alerts SET stage = $1, escalation_level = $2, escalated_at = now()
  ```

**Alert Flow:**
1. **Trigger Sources:** `panic`, `detection`, `check_in`
2. **Stages:** `soft_alert` → `medium_alert` → `high_alert`
3. **Escalation:** Automatic escalation via queues after time delays

**Foreign Keys:** `user_id` → `users.id` (cascade delete)

**Index:** `idx_alerts_user` on `(user_id, created_at DESC)`

---

### 9. **watch_sessions** (Alert Response Sessions)
**Columns Used:** `id`, `alert_id`, `user_id`, `status`, `escalation_level`, `started_at`, `ended_at`, `last_location_at`

**Files Referencing:**
- [alerts/alerts.service.js](alerts/alerts.service.js) - Create session with alert, update escalation
- [sessions/sessions.service.js](sessions/sessions.service.js) - Get active session, close session
- [locations/locations.service.js](locations/locations.service.js) - Update last_location_at
- [admin/admin.service.js](admin/admin.service.js) - Join for session tracking

**Operations:**
- SELECT (get active session for user, joined with alerts)
- INSERT (create session when alert created)
  ```sql
  INSERT INTO watch_sessions (alert_id, user_id, status, escalation_level)
  VALUES ($1, $2, 'active', $3)
  ```
- UPDATE (mark completed, update escalation level, update location timestamp)

**Status Values:** `active`, `completed`, `cancelled`

**Foreign Keys:**
- `alert_id` → `alerts.id` (cascade delete)
- `user_id` → `users.id` (cascade delete)

**Index:** `idx_watch_sessions_user` on `(user_id, status)`

---

### 10. **location_logs** (Geolocation Data)
**Columns Used:** `id`, `session_id`, `user_id`, `lat`, `lng`, `accuracy_m`, `source`, `recorded_at`, `created_at`

**Files Referencing:**
- [locations/locations.service.js](locations/locations.service.js) - Ingest locations, list session locations
  ```sql
  INSERT INTO location_logs (
    session_id, user_id, lat, lng, accuracy_m, source, recorded_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  ```

**Operations:**
- SELECT (list all locations for a session, ordered by recorded_at)
- INSERT (batch ingest locations during active session)
- JOIN (with watch_sessions for location history)

**Data Sources:** `mobile`, `web`, `api`

**Foreign Keys:**
- `session_id` → `watch_sessions.id` (cascade delete)
- `user_id` → `users.id` (cascade delete)

**Index:** `idx_location_logs_session` on `(session_id, recorded_at DESC)`

---

### 11. **reports** (Community Reports/Incidents)
**Columns Used:** `id`, `user_id`, `session_id`, `title`, `description`, `status`, `category`, `severity`, `lat`, `lng`, `location_accuracy_m`, `visibility_scope`, `distribution_status`, `distribution_reason`, `requires_manual_review`, `throttled_until`, `restriction_applied`, `created_at`

**Files Referencing:**
- [reports/reports.service.js](reports/reports.service.js) - Full report lifecycle
  - Create report
  - Get report details
  - Submit flag
  - Submit confirmation
- [admin/admin.service.js](admin/admin.service.js) - List reports for admin review
- [credibility/credibility.logic.js](credibility/credibility.logic.js) - Refresh signals on flag/confirmation

**Operations:**
- SELECT (get report by ID, list reports for user, filtered by status)
- INSERT (create new report with location and metadata)
  ```sql
  INSERT INTO reports (
    user_id, session_id, title, description, category, severity,
    lat, lng, location_accuracy_m, visibility_scope
  ) VALUES (...)
  ```
- UPDATE (mark as reviewed, update distribution status)

**Status Values:** `open`, `under_review`, `resolved`, `archived`

**Severity Levels:** `low`, `medium`, `high`, `critical`

**Visibility Scopes:** `nearby_only`, `city_wide`, `regional`, `national`

**Foreign Keys:**
- `user_id` → `users.id` (cascade delete)
- `session_id` → `watch_sessions.id` (set null on delete)

**Index:** `idx_reports_geocluster` on `(lat, lng, created_at DESC)`

---

### 12. **report_media** (Report Attachments)
**Columns Used:** `id`, `report_id`, `url`, `mime_type`, `created_at`

**Files Referencing:**
- [reports/reports.service.js](reports/reports.service.js) - Add media URLs to report
  ```sql
  INSERT INTO report_media (report_id, url, mime_type)
  VALUES ($1, $2, $3)
  ```

**Operations:**
- SELECT (get all media for report)
- INSERT (attach media to report during report creation)
- DELETE (cascade delete when report deleted)

**Supported Mime Types:** `image/jpeg`, `image/png`, `video/mp4`, etc.

**Foreign Keys:** `report_id` → `reports.id` (cascade delete)

---

### 13. **report_flags** (Report Credibility Flags)
**Columns Used:** `id`, `report_id`, `user_id`, `reason`, `created_at`

**Files Referencing:**
- [reports/reports.service.js](reports/reports.service.js) - Flag report as problematic
  ```sql
  INSERT INTO report_flags (report_id, user_id, reason)
  VALUES ($1, $2, $3)
  ```

**Operations:**
- SELECT (count flags for report, check if user already flagged)
- INSERT (flag report, prevent duplicates)
- COUNT (aggregated in report queries)

**Unique Constraint:**
```sql
CREATE UNIQUE INDEX idx_report_flags_unique ON report_flags(report_id, user_id)
```

**Foreign Keys:**
- `report_id` → `reports.id` (cascade delete)
- `user_id` → `users.id` (cascade delete)

---

### 14. **report_confirmations** (Report Verification)
**Columns Used:** `id`, `report_id`, `user_id`, `created_at`

**Files Referencing:**
- [reports/reports.service.js](reports/reports.service.js) - Confirm report accuracy
  ```sql
  INSERT INTO report_confirmations (report_id, user_id)
  VALUES ($1, $2)
  ```

**Operations:**
- SELECT (count confirmations, check if user confirmed)
- INSERT (add confirmation, prevent duplicates)
- COUNT (aggregated in report queries)

**Unique Constraint:**
```sql
CREATE UNIQUE INDEX idx_report_confirmations_unique ON report_confirmations(report_id, user_id)
```

**Foreign Keys:**
- `report_id` → `reports.id` (cascade delete)
- `user_id` → `users.id` (cascade delete)

---

### 15. **risk_zones** (Pre-defined Danger Areas)
**Columns Used:** `id`, `name`, `lat`, `lng`, `radius_m`, `risk_level`, `created_at`

**Files Referencing:**
- [risk-zones/risk-zones.service.js](risk-zones/risk-zones.service.js) - List risk zones
  ```sql
  SELECT * FROM risk_zones ORDER BY created_at DESC
  ```

**Operations:**
- SELECT (list all risk zones, used for geofencing alerts)
- INSERT (admin creates risk zone)
- UPDATE (modify zone parameters)

**Risk Levels:** `low`, `medium`, `high`, `critical`

---

### 16. **subscriptions** (User Subscription Status)
**Columns Used:** `id`, `user_id`, `provider`, `status`, `plan_name`, `amount_ngn`, `started_at`, `current_period_end`, `provider_ref`

**Files Referencing:**
- [subscriptions/subscriptions.service.js](subscriptions/subscriptions.service.js) - Manage subscriptions
  - Get stored subscription snapshot
  - Sync with RevenueCat
  - Persist subscription data

**Operations:**
- SELECT (get user's active subscription)
- INSERT (create subscription record)
- UPDATE (update subscription status and period)

**Providers:** `app_store`, `play_store`, `revenuecat`

**Status Values:** `active`, `trialing`, `grace_period`, `cancelled`, `expired`, `inactive`

**Foreign Keys:** `user_id` → `users.id` (cascade delete)

---

### 17. **latency_metrics** (Performance Tracking)
**Columns Used:** `id`, `user_id`, `metric_type`, `latency_ms`, `recorded_at`

**Files Referencing:**
- [latency/latency.service.js](latency/latency.service.js) - Record and report latency metrics
  ```sql
  INSERT INTO latency_metrics (user_id, metric_type, latency_ms)
  VALUES ($1, $2, $3)
  ```

**Operations:**
- SELECT (list metrics for user, aggregate for summary)
- INSERT (record new latency measurement)

**Metric Types:** `location_sync`, `alert_response`, `network_round_trip`, etc.

**Foreign Keys:** `user_id` → `users.id` (cascade delete)

---

### 18. **latency_summary** (Daily Performance Summaries)
**Columns Used:** `id`, `date`, `avg_latency_ms`, `p95_latency_ms`, `created_at`

**Files Referencing:**
- [latency/latency.service.js](latency/latency.service.js) - Compute and store daily summaries
  ```sql
  SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int
  UPDATE latency_summary SET avg_latency_ms = $1, p95_latency_ms = $2 WHERE date = $3
  ```

**Operations:**
- SELECT (get daily summaries, last 30 days)
- INSERT (create daily summary)
- UPDATE (update daily stats)

**Aggregation:** Computed from latency_metrics daily

---

### 19. **notifications** (Notification Log)
**Columns Used:** `id`, `user_id`, `type`, `channel`, `status`, `payload`, `related_session_id`, `created_at`, `sent_at`

**Files Referencing:**
- [notifications/notifications.service.js](notifications/notifications.service.js) - List notifications
- [queues/queues.service.js](queues/queues.service.js) - Insert notifications during job processing

**Operations:**
- SELECT (list notifications for user, limit 100)
- INSERT (create notification record during alert/event)

**Channels:** `sms`, `push`, `email`, `webhook`

**Status Values:** `pending`, `sent`, `failed`, `read`

**Foreign Keys:** 
- `user_id` → `users.id` (cascade delete)
- `related_session_id` → `watch_sessions.id` (optional)

---

### 20. **telemetry_events** (User Activity Tracking)
**Columns Used:** `id`, `user_id`, `event_name`, `properties`, `created_at`

**Files Referencing:**
- [telemetry/telemetry.service.js](telemetry/telemetry.service.js) - Ingest telemetry events
  ```sql
  INSERT INTO telemetry_events (user_id, event_name, properties)
  VALUES ($1, $2, $3)
  ```

**Operations:**
- SELECT (query user events, optional filtering)
- INSERT (log user action with properties)

**Event Examples:** `screen_view`, `button_click`, `error_occurred`, `feature_used`

**Foreign Keys:** `user_id` → `users.id` (cascade delete)

---

### 21. **admin_audit_logs** (Administrative Actions Log)
**Columns Used:** `id`, `admin_user_id`, `action`, `target_type`, `target_id`, `metadata`, `created_at`

**Files Referencing:**
- [admin/admin.service.js](admin/admin.service.js) - Log admin actions
  ```sql
  INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
  VALUES ($1, $2, $3, $4, $5)
  ```

**Operations:**
- SELECT (query audit trail)
- INSERT (log admin action)

**Action Types:** `alert_resolved`, `report_reviewed`, `user_restricted`, `role_assigned`

**Target Types:** `alert`, `report`, `user`, `role_request`

**Foreign Keys:** `admin_user_id` → `users.id` (set null on delete)

---

### 22. **user_credibility_profiles** (User Reputation System)
**Columns Used:** `id`, `user_id`, `score`, `rating_tier`, `restriction_level`, `restriction_expires_at`, `warning_count`, `total_reports_count`, `confirmed_true_reports_count`, `likely_true_reports_count`, `inconclusive_reports_count`, `false_reports_count`, `malicious_reports_count`, `corroborated_reports_count`, `quality_score_avg`, `last_reported_at`, `last_scored_at`, `created_at`, `updated_at`

**Files Referencing:**
- [credibility/credibility.logic.js](credibility/credibility.logic.js) - Create/refresh credibility profile
  ```sql
  INSERT INTO user_credibility_profiles (user_id, score, rating_tier, restriction_level, ...)
  UPDATE user_credibility_profiles SET score = $1, rating_tier = $2, ...
  ```
- [users/users.service.js](users/users.service.js) - Include in user profile
- [auth/auth.service.js](auth/auth.service.js) - Include in auth response
- [admin/admin.service.js](admin/admin.service.js) - View user scores

**Operations:**
- SELECT (get user's credibility profile)
- INSERT (create new profile for user)
- UPDATE (refresh score based on report outcomes)

**Score Range:** 0-100 (default: 50)

**Rating Tiers:** 
- `high` (80-100)
- `mid` (45-79)
- `low` (0-44)

**Restriction Levels:**
- `none`
- `warning` (1+ false reports)
- `temporary_restriction` (3+ false reports OR 1+ malicious)
- `shadow_restriction` (2+ malicious OR 5+ false reports)
- `ban` (3+ malicious reports)

**Foreign Keys:** `user_id` → `users.id` (unique, cascade delete)

---

### 23. **report_classifications** (AI/Admin Classification)
**Columns Used:** `id`, `report_id`, `classification`, `response_outcome`, `ai_confidence`, `quality_score`, `credibility_snapshot`, `corroboration_count`, `notes`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at`

**Files Referencing:**
- [credibility/credibility.logic.js](credibility/credibility.logic.js) - Create/update classification
- [admin/admin.service.js](admin/admin.service.js) - Query classifications for review

**Operations:**
- SELECT (get classification for report)
- INSERT (create classification from AI or admin review)
- UPDATE (update with admin notes and outcome)

**Classifications:**
- `confirmed_true` (actual incident reported)
- `likely_true` (probable incident)
- `inconclusive` (cannot determine)
- `false` (false alarm/misreporting)
- `malicious` (intentionally false/harmful)

**Response Outcomes:**
- `pending` (awaiting review)
- `validated` (admin confirmed)
- `action_taken` (authorities responded)
- `dismissed` (false positive)
- `no_action` (reviewed but no action needed)

**Foreign Keys:**
- `report_id` → `reports.id` (unique, cascade delete)
- `reviewed_by` → `users.id` (set null on delete)

---

### 24. **waitlist_signups** (Waitlist Management)
**Columns Used:** `id`, `phone`, `email`, `source`, `created_at`

**Files Referencing:**
- [waitlist/waitlist.service.js](waitlist/waitlist.service.js) - Add to waitlist
  ```sql
  INSERT INTO waitlist_signups (phone, email, source)
  VALUES ($1, $2, $3)
  ```

**Operations:**
- SELECT (query waitlist, export for email campaigns)
- INSERT (add new signup)

**Source Values:** `web`, `app`, `referral`, `social`, `ad`

---

## Service Files Organization

### Core Services Using Database
| Service | Tables | Purpose |
|---------|--------|---------|
| **alerts** | alerts, watch_sessions, users | Alert creation, escalation, cancellation |
| **auth** | users, user_devices, user_roles, roles, user_credibility_profiles | Authentication and user registration |
| **contacts** | trusted_contacts, user_trust_profiles, users | Manage emergency contacts |
| **credibility** | user_credibility_profiles, report_classifications, reports | Calculate user reputation |
| **db** | ALL | Database connection and pooling |
| **latency** | latency_metrics, latency_summary | Performance metrics |
| **locations** | location_logs, watch_sessions | Geolocation ingestion |
| **notifications** | notifications, users | Notification logging |
| **reports** | reports, report_media, report_flags, report_confirmations, users | Report management |
| **roles** | roles, user_roles, reviewer_role_requests, users | Role management |
| **sessions** | watch_sessions, alerts, location_logs | Session lifecycle |
| **subscriptions** | subscriptions, users | Subscription tracking |
| **telemetry** | telemetry_events | Event tracking |
| **admin** | reports, report_classifications, alerts, watch_sessions, admin_audit_logs, users, report_flags, report_confirmations | Admin dashboard |
| **queues** | alerts, watch_sessions, notifications | Background job processing |
| **waitlist** | waitlist_signups | Waitlist management |

---

## Database Operations by Type

### CREATE Operations (INSERT)
```javascript
// NEW USERS
INSERT INTO users (phone_e164, name, email, status)
INSERT INTO user_devices (user_id, device_id, platform, fcm_token)
INSERT INTO user_credibility_profiles (user_id, score, rating_tier, restriction_level)

// ALERTS
INSERT INTO alerts (user_id, status, trigger_source, stage, escalation_level, risk_snapshot)
INSERT INTO watch_sessions (alert_id, user_id, status, escalation_level)

// LOCATIONS
INSERT INTO location_logs (session_id, user_id, lat, lng, accuracy_m, source, recorded_at)

// REPORTS
INSERT INTO reports (user_id, session_id, title, description, category, severity, lat, lng)
INSERT INTO report_media (report_id, url, mime_type)
INSERT INTO report_flags (report_id, user_id, reason)
INSERT INTO report_confirmations (report_id, user_id)
INSERT INTO report_classifications (report_id, classification, response_outcome, ai_confidence)

// CONTACTS
INSERT INTO trusted_contacts (user_id, contact_name, contact_phone, contact_email, status, priority)
INSERT INTO user_trust_profiles (user_id, contact_id, can_view_location, can_view_history, can_sms, can_call)

// ADMIN/ROLES
INSERT INTO reviewer_role_requests (user_id, motivation, status)
INSERT INTO user_roles (user_id, role_id)
INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)

// METRICS
INSERT INTO latency_metrics (user_id, metric_type, latency_ms)
INSERT INTO telemetry_events (user_id, event_name, properties)
INSERT INTO notifications (user_id, type, channel, status, payload, related_session_id)

// SUBSCRIPTIONS
INSERT INTO subscriptions (user_id, provider, status, plan_name, amount_ngn, current_period_end)

// WAITLIST
INSERT INTO waitlist_signups (phone, email, source)
```

### READ Operations (SELECT)
```javascript
// User Profile
SELECT * FROM users WHERE id = $1
SELECT * FROM user_credibility_profiles WHERE user_id = $1
SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1

// Alerts & Sessions
SELECT s.*, a.* FROM watch_sessions s 
LEFT JOIN alerts a ON a.id = s.alert_id 
WHERE s.user_id = $1 AND s.status = 'active'

// Locations
SELECT * FROM location_logs WHERE session_id = $1 AND user_id = $2 ORDER BY recorded_at DESC

// Reports (with counts)
SELECT r.*, 
  (SELECT COUNT(*) FROM report_flags WHERE report_id = r.id) as flags_count,
  (SELECT COUNT(*) FROM report_confirmations WHERE report_id = r.id) as confirmations_count
FROM reports r WHERE r.user_id = $1

// Contacts
SELECT tc.*, utp.* FROM trusted_contacts tc
LEFT JOIN user_trust_profiles utp ON utp.contact_id = tc.id
WHERE tc.user_id = $1 ORDER BY tc.priority

// Admin Queries
SELECT * FROM admin_audit_logs ORDER BY created_at DESC
SELECT * FROM alerts a LEFT JOIN watch_sessions s ON s.alert_id = a.id 
WHERE (date conditions) ORDER BY (relevance)
```

### UPDATE Operations
```javascript
// User Profile
UPDATE users SET name = $1, email = $2, updated_at = now() WHERE id = $3

// Alerts
UPDATE alerts SET status = 'resolved', resolved_at = now() WHERE id = $1 AND user_id = $2
UPDATE alerts SET stage = $1, escalation_level = $2, escalated_at = now()
UPDATE alerts SET risk_score = $1, risk_snapshot = $2, detection_summary = $3

// Sessions
UPDATE watch_sessions SET status = 'completed', ended_at = now() WHERE id = $1 AND user_id = $2
UPDATE watch_sessions SET escalation_level = $1, last_location_at = now()

// Reports
UPDATE reports SET status = 'under_review', distribution_status = 'sent'
UPDATE reports SET requires_manual_review = false, throttled_until = $1

// Credibility
UPDATE user_credibility_profiles SET 
  score = $1, 
  rating_tier = $2, 
  restriction_level = $3,
  (many status counts)
  WHERE user_id = $4

// Subscriptions
UPDATE subscriptions SET status = $1, current_period_end = $2 WHERE user_id = $3

// Latency Summary
UPDATE latency_summary SET avg_latency_ms = $1, p95_latency_ms = $2 WHERE date = $3

// Trust Profiles
UPDATE user_trust_profiles SET 
  can_view_location = $1, 
  can_view_history = $2,
  can_sms = $3,
  can_call = $4
  WHERE id = $5
```

### DELETE Operations
```javascript
// Cascade via foreign keys:
// DELETE FROM users -> deletes user_devices, alerts, reports, locations, etc.
// DELETE FROM reports -> deletes report_media, report_flags, report_confirmations
// DELETE FROM trusted_contacts -> deletes user_trust_profiles
// DELETE FROM watch_sessions -> deletes location_logs
```

---

## Migration Files

### 001_init.sql (Schema Foundation)
- Creates: users, user_devices, roles, user_roles, trusted_contacts, user_trust_profiles, alerts, watch_sessions, location_logs, reports, report_media, report_flags, report_confirmations, risk_zones, latency_metrics, latency_summary, notifications, subscriptions, telemetry_events, admin_audit_logs, waitlist_signups
- Enables RLS on user-facing tables
- Creates indexes for performance

### 002_credibility_system.sql
- Creates: user_credibility_profiles, report_classifications
- Adds extended columns to reports (category, severity, lat, lng, visibility_scope, distribution_status, etc.)
- Creates RLS policies for credibility data

### 003_roles_and_reviewer_requests.sql
- Creates: reviewer_role_requests (if not exists - may already be in 001)
- Sets up RLS policies for role requests
- Inserts system roles data

### 004_email_auth.sql
- Modifies: users table (makes phone_e164 optional)
- Adds email auth support constraint

### 005_guardian_workflow.sql
- Extends: alerts table (adds stage, risk_score, risk_snapshot, detection_summary, cancel_expires_at, escalated_at)
- Migration for guardian workflow feature

---

## Transaction Support

Many operations use database transactions for data consistency:

```javascript
// Example from contacts.service.js
async create(userId, body) {
  return this.db.transaction(async (client) => {
    // Insert contact
    const contactResult = await client.query(INSERT ..., []);
    
    // Insert trust profile
    const profileResult = await client.query(INSERT ..., []);
    
    // Both succeed or both rollback
    return mapContactRow(contactResult.rows[0]);
  });
}
```

Key services using transactions:
- **contacts** - Create contact + trust profile
- **sessions** - Close session + update alert
- **locations** - Batch ingest + update session
- **latency** - Record metric + update summary
- **reports** - Create report + attach media
- **alerts** - Create alert + session + schedule escalation

---

## Security Notes

### Row-Level Security (RLS) Enabled
Tables with RLS active:
- users
- user_devices
- trusted_contacts
- user_trust_profiles
- reviewer_role_requests
- alerts
- watch_sessions
- location_logs
- reports
- user_credibility_profiles
- report_classifications
- notifications
- subscriptions
- telemetry_events

### Authentication Context
- `auth.uid()` is used in RLS policies to enforce user isolation
- JWT token provided by `@UseGuards(JwtAuthGuard)` decorators
- Service role key used for admin/backend operations when needed

### Sensitive Data
- **Phone/Email:** Case-insensitive email storage, phone_e164 standardization
- **Locations:** Restricted to users and trusted contacts with permissions
- **Credibility Scores:** Visible to user and admins only
- **Audit Logs:** Admin-only access

---

## Performance Optimization

### Indexes
```sql
-- User lookups
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email)) WHERE email IS NOT NULL

-- Location queries
CREATE INDEX idx_location_logs_session ON location_logs(session_id, recorded_at DESC)

-- Alert queries
CREATE INDEX idx_alerts_user ON alerts(user_id, created_at DESC)

-- Session queries
CREATE INDEX idx_watch_sessions_user ON watch_sessions(user_id, status)

-- Report queries
CREATE INDEX idx_reports_geocluster ON reports(lat, lng, created_at DESC)

-- Role requests
CREATE UNIQUE INDEX idx_reviewer_role_requests_pending_user 
  ON reviewer_role_requests(user_id) WHERE status = 'pending'

-- Flags and confirmations
CREATE UNIQUE INDEX idx_report_flags_unique ON report_flags(report_id, user_id)
CREATE UNIQUE INDEX idx_report_confirmations_unique ON report_confirmations(report_id, user_id)

-- Credibility lookups
CREATE INDEX idx_user_credibility_profiles_user ON user_credibility_profiles(user_id)
```

---

## Connection Details

### Database Connection
- **Location:** `apps/backend/src/db/db.service.js`
- **Client:** Node pg library (`pg.Pool`)
- **Connection String:** `SUPABASE_DB_URL` or `DATABASE_URL` environment variable
- **SSL:** Auto-detected for Supabase cloud, configurable via `DB_SSL_MODE`

### Query Pattern
```javascript
// Direct query
const result = await this.db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// With transaction
const result = await this.db.transaction(async (client) => {
  const r1 = await client.query(...);
  const r2 = await client.query(...);
  return { r1, r2 };
});
```

### Environment Variables Required
- `SUPABASE_DB_URL` or `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - For Supabase authentication endpoints
- `SUPABASE_SERVICE_ROLE_KEY` - For server-side auth operations
- `DB_SSL_MODE` - SSL configuration (optional, auto for cloud)

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total Tables** | 24 |
| **Service Files** | 15+ major services |
| **Referenced Tables (All)** | 24 (100% coverage) |
| **INSERT Operations** | ~40+ distinct patterns |
| **SELECT Operations** | ~30+ distinct patterns |
| **UPDATE Operations** | ~15+ distinct patterns |
| **Tables with Indexes** | 8+ |
| **Tables with RLS** | 14+ |
| **Foreign Key Relationships** | 30+ |
| **Unique Constraints** | 8+ |

---

## Key Findings

1. **Full Schema Coverage:** Every table in the schema is actively used by backend services
2. **Transactional Consistency:** Multi-step operations use transactions for data integrity
3. **Strong Security:** RLS policies and role-based access control throughout
4. **Geospatial Focus:** Significant use of lat/lng for location-based features
5. **Credibility System:** Comprehensive reputation tracking with multiple metrics
6. **Audit Trail:** All admin actions logged for compliance
7. **Extensibility:** JSON columns (payload, properties, risk_snapshot, detection_summary) allow flexible data storage
8. **Performance Optimized:** Strategic indexes on frequently queried fields and filters
