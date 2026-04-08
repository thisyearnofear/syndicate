-- Migration: Add user activity events for bridge/deposit lifecycle persistence

CREATE TABLE IF NOT EXISTS user_activity_events (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('bridge', 'vault_deposit')),
  protocol TEXT,
  amount TEXT,
  tx_hash TEXT,
  source_chain TEXT,
  destination_chain TEXT,
  source_address TEXT,
  destination_address TEXT,
  status TEXT,
  error TEXT,
  bridge_activity_id TEXT,
  target_strategy TEXT,
  linked_vault_protocol TEXT,
  linked_deposit_tx_hash TEXT,
  metadata JSONB,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_activity_wallet_address
  ON user_activity_events(wallet_address);

CREATE INDEX IF NOT EXISTS idx_user_activity_event_type
  ON user_activity_events(event_type);

CREATE INDEX IF NOT EXISTS idx_user_activity_updated_at
  ON user_activity_events(updated_at DESC);
