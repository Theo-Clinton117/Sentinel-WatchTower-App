-- 008_optional_simplifications.sql
-- OPTIONAL: Simplify bloated/overcomplicated tables
-- Run these only if you want to streamline specific tables
-- Read each section comment before executing

-- ============================================================================
-- OPTION 1: Simplify reports table (OPTIONAL - BACKUP FIRST)
-- ============================================================================
-- Current: Reports table has evolved to include distribution logic
-- Issue: Mixing core report data with distribution/classification logic
-- Recommendation: Keep as-is (logical separation via report_classifications works well)
--
-- If you want to archive old unused columns, run this:
-- ALTER TABLE reports DROP COLUMN IF EXISTS review_source;
-- (Note: Already removed in current schema)


-- ============================================================================
-- OPTION 2: Consolidate alerts related data (OPTIONAL)
-- ============================================================================
-- Current: watch_sessions stores alert responses separately
-- Pro: Clean separation of alert lifecycle from response tracking
-- Con: Requires JOIN to get complete alert+session picture
-- Recommendation: Keep as-is for normalization benefits
--
-- Example query to retrieve complete alert context:
-- SELECT a.*, s.*, l.lat, l.lng FROM alerts a
-- LEFT JOIN watch_sessions s ON s.alert_id = a.id
-- LEFT JOIN location_logs l ON l.session_id = s.id
-- WHERE a.user_id = $1;


-- ============================================================================
-- OPTION 3: Consolidate credibility system (OPTIONAL)
-- ============================================================================
-- Current: user_credibility_profiles is separate table tracking scores
-- Pro: Dedicated table for auditing score changes independently
-- Con: Extra JOIN needed to get user + credibility context
-- Recommendation: Keep separate (enables audit trailing and performance)
--
-- If denormalization is needed for performance:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS credibility_score int DEFAULT 50;
-- (But this would create data sync issues - not recommended)


-- ============================================================================
-- OPTION 4: Simplify latency_metrics (ALREADY DONE)
-- ============================================================================
-- Your schema list was outdated - actual implementation is clean:
--   - Old concept: event_id, source, client_sent/received/server_recorded_at, metadata
--   - Current: user_id, metric_type, latency_ms, recorded_at (simplified & working)
-- No action needed.


-- ============================================================================
-- OPTION 5: Enhanced Risk Zones (IMPLEMENTED IN 007)
-- ============================================================================
-- Already handled in 007_add_risk_zones_audit_trail.sql
-- Adds tracking for who updates/resolves zones


-- ============================================================================
-- OPTION 6: Flatten trusted_contacts + user_trust_profiles (NOT RECOMMENDED)
-- ============================================================================
-- Current: Two-table design:
--   - trusted_contacts: contact info
--   - user_trust_profiles: permissions for each contact
--
-- Pro: Enables different permission sets per contact relationship
-- Con: Requires JOIN for every contact query
--
-- Only flatten if you need ONE permission profile per contact:
-- ALTER TABLE trusted_contacts 
-- ADD COLUMN can_view_location boolean DEFAULT true,
-- ADD COLUMN can_view_history boolean DEFAULT false,
-- ADD COLUMN can_sms boolean DEFAULT true,
-- ADD COLUMN can_call boolean DEFAULT true;
--
-- Then migrate: UPDATE trusted_contacts tc SET 
--   can_view_location = utp.can_view_location,
--   can_view_history = utp.can_view_history,
--   can_sms = utp.can_sms,
--   can_call = utp.can_call
-- FROM user_trust_profiles utp WHERE utp.contact_id = tc.id;
--
-- WARNING: Not recommended - current design is correct for permission granularity


-- ============================================================================
-- SUMMARY: SCHEMA IS WELL-DESIGNED
-- ============================================================================
-- ✓ Proper normalization following 3NF
-- ✓ Separation of concerns (alerts vs responses, reports vs classifications)
-- ✓ Audit trails preserved (credibility, admin logs)
-- ✓ RLS policies properly configured
-- ✓ Indexes placed on hot paths
--
-- Only execute migrations 006 & 007 for missing critical columns.
-- Do NOT need to simplify further.
