-- Migration: Add yield vault support for syndicates
-- Tracks vault deposits, yield accrual, and yield-to-tickets conversions

-- Add vault columns to syndicate_pools
ALTER TABLE syndicate_pools 
  ADD COLUMN IF NOT EXISTS vault_strategy TEXT,
  ADD COLUMN IF NOT EXISTS vault_address TEXT,
  ADD COLUMN IF NOT EXISTS vault_chain_id INTEGER DEFAULT 8453,
  ADD COLUMN IF NOT EXISTS auto_convert_yield BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS yield_conversion_threshold DECIMAL(20, 6) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS yield_withdrawal_at BIGINT;

-- Create syndicate_vault_deposits table
CREATE TABLE IF NOT EXISTS syndicate_vault_deposits (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pool_id TEXT NOT NULL REFERENCES syndicate_pools(id) ON DELETE CASCADE,
  member_address TEXT NOT NULL,
  amount_usdc DECIMAL(20, 6) NOT NULL,
  yield_accrued_usdc DECIMAL(20, 6) DEFAULT 0,
  tx_hash TEXT,
  deposited_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Create yield_conversions table
CREATE TABLE IF NOT EXISTS yield_conversions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pool_id TEXT NOT NULL REFERENCES syndicate_pools(id) ON DELETE CASCADE,
  yield_amount_usdc DECIMAL(20, 6) NOT NULL,
  tickets_purchased INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  converted_at BIGINT NOT NULL
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_vault_deposits_pool_id ON syndicate_vault_deposits(pool_id);
CREATE INDEX IF NOT EXISTS idx_vault_deposits_member ON syndicate_vault_deposits(member_address);
CREATE INDEX IF NOT EXISTS idx_yield_conversions_pool_id ON yield_conversions(pool_id);

-- Add comments
COMMENT ON TABLE syndicate_vault_deposits IS 'Deposits to syndicate vaults with yield tracking';
COMMENT ON TABLE yield_conversions IS 'Yield to tickets conversions';
COMMENT ON COLUMN syndicate_pools.vault_strategy IS 'Yield strategy: aave, morpho, drift, pooltogether';
COMMENT ON COLUMN syndicate_pools.auto_convert_yield IS 'Automatically convert yield to tickets when threshold met';
COMMENT ON COLUMN syndicate_pools.yield_conversion_threshold IS 'Minimum yield amount before auto-conversion';
