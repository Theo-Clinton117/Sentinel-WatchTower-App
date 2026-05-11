-- 007_add_risk_zones_audit_trail.sql
-- Add status tracking and audit columns to risk_zones table

ALTER TABLE risk_zones
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_risk_zones_status 
ON risk_zones(status, updated_at DESC);

-- Create index for active zones
CREATE INDEX IF NOT EXISTS idx_risk_zones_active 
ON risk_zones(status, center_lat, center_lng)
WHERE status = 'active';

-- Create index for resolution audit trail
CREATE INDEX IF NOT EXISTS idx_risk_zones_resolved 
ON risk_zones(resolved_by, resolved_at DESC)
WHERE resolved_at IS NOT NULL;

COMMENT ON COLUMN risk_zones.status IS 'Zone status: active, archived, or resolved';
COMMENT ON COLUMN risk_zones.updated_by IS 'User ID of admin who last updated this zone';
COMMENT ON COLUMN risk_zones.updated_at IS 'Timestamp of last zone update';
COMMENT ON COLUMN risk_zones.resolved_by IS 'User ID of admin who resolved this zone';
COMMENT ON COLUMN risk_zones.resolved_at IS 'Timestamp when zone was marked as resolved';
