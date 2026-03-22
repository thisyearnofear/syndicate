-- Migration: Add prize_distributions table
-- Tracks prize distribution events for syndicates

CREATE TABLE IF NOT EXISTS prize_distributions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pool_id TEXT NOT NULL REFERENCES syndicate_pools(id),
  prize_amount_usdc DECIMAL(20, 6) NOT NULL,
  member_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'calculating', 'distributing', 'completed', 'failed')),
  tx_hash TEXT,
  error TEXT,
  created_at BIGINT NOT NULL,
  completed_at BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_prize_distributions_pool_id ON prize_distributions(pool_id);
CREATE INDEX IF NOT EXISTS idx_prize_distributions_status ON prize_distributions(status);
CREATE INDEX IF NOT EXISTS idx_prize_distributions_created_at ON prize_distributions(created_at DESC);

-- Add comment
COMMENT ON TABLE prize_distributions IS 'Tracks prize distributions for syndicate pools';
