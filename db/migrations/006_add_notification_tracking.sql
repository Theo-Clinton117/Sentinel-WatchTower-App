-- 006_add_notification_tracking.sql
-- Add delivery and read status tracking to notifications table

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Create index for read status queries
CREATE INDEX IF NOT EXISTS idx_notifications_read_status 
ON notifications(user_id, read_at, created_at DESC)
WHERE read_at IS NULL;

-- Create index for delivery tracking queries
CREATE INDEX IF NOT EXISTS idx_notifications_delivered_status 
ON notifications(user_id, delivered_at, created_at DESC)
WHERE delivered_at IS NULL;

COMMENT ON COLUMN notifications.delivered_at IS 'Timestamp when notification was successfully delivered to user device';
COMMENT ON COLUMN notifications.read_at IS 'Timestamp when user read/viewed the notification';
