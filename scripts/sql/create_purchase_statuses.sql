CREATE TABLE IF NOT EXISTS purchase_statuses (
  stacks_tx_id TEXT PRIMARY KEY,
  source_tx_id TEXT,
  source_chain TEXT,
  bridge_id TEXT,
  status TEXT NOT NULL,
  base_tx_id TEXT,
  recipient_base_address TEXT,
  purchase_id INTEGER,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE purchase_statuses
  ADD COLUMN IF NOT EXISTS source_tx_id TEXT;

ALTER TABLE purchase_statuses
  ADD COLUMN IF NOT EXISTS source_chain TEXT;

ALTER TABLE purchase_statuses
  ADD COLUMN IF NOT EXISTS bridge_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_statuses_source_tx_id_idx
  ON purchase_statuses (source_tx_id);

CREATE INDEX IF NOT EXISTS purchase_statuses_updated_at_idx
  ON purchase_statuses (updated_at DESC);
