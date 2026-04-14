-- Migration: Add notifications table
-- Stores notifications for syndicate members

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pool_id UUID REFERENCES syndicate_pools(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'deposit_received',
    'distribution_completed', 
    'threshold_met',
    'win_announced',
    'member_joined',
    'system'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at BIGINT NOT NULL
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_pool_id ON notifications(pool_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_pool_unread ON notifications(pool_id, read) WHERE read = false;

-- Add comments
COMMENT ON TABLE notifications IS 'Notifications for syndicate members';
COMMENT ON COLUMN notifications.data IS 'Additional notification data as JSON';
COMMENT ON COLUMN notifications.read IS 'Whether the notification has been read';
