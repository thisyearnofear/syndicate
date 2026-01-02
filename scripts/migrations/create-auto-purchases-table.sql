/**
 * Migration: Create auto_purchases table
 * 
 * Stores recurring purchase configurations created by users
 * Gelato Web3 Function queries this to find due purchases
 * 
 * Run with: psql $DATABASE_URL < create-auto-purchases-table.sql
 */

-- Create auto_purchases table
CREATE TABLE IF NOT EXISTS auto_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Permission reference
  user_address TEXT NOT NULL,
  permission_id UUID NOT NULL REFERENCES advanced_permissions(id) ON DELETE CASCADE,
  
  -- Purchase configuration
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  amount_per_period NUMERIC(20, 6) NOT NULL, -- USDC amount with 6 decimals
  
  -- Execution tracking
  is_active BOOLEAN DEFAULT true,
  last_executed_at INTEGER NOT NULL DEFAULT 0, -- Unix timestamp
  next_execution_at INTEGER, -- Calculated timestamp for next run
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Optimistic locking
  nonce INTEGER DEFAULT 0,
  
  -- Constraints
  CONSTRAINT valid_amount CHECK (amount_per_period > 0),
  CONSTRAINT valid_frequency CHECK (frequency IN ('daily', 'weekly', 'monthly'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_auto_purchases_user_address 
  ON auto_purchases(user_address);

CREATE INDEX IF NOT EXISTS idx_auto_purchases_is_active 
  ON auto_purchases(is_active);

CREATE INDEX IF NOT EXISTS idx_auto_purchases_permission_id 
  ON auto_purchases(permission_id);

-- Composite index for queries filtering by active + last_executed_at
CREATE INDEX IF NOT EXISTS idx_auto_purchases_active_executed 
  ON auto_purchases(is_active, last_executed_at);

-- Enable row-level security if your app uses it
-- ALTER TABLE auto_purchases ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE auto_purchases IS 'Stores recurring purchase configurations for Gelato automation';
COMMENT ON COLUMN auto_purchases.frequency IS 'How often to execute: daily, weekly, or monthly';
COMMENT ON COLUMN auto_purchases.amount_per_period IS 'USDC amount to spend per execution (6 decimal places)';
COMMENT ON COLUMN auto_purchases.is_active IS 'Whether this automation is currently enabled';
COMMENT ON COLUMN auto_purchases.last_executed_at IS 'Unix timestamp of last successful execution';
COMMENT ON COLUMN auto_purchases.nonce IS 'Version counter for optimistic locking';
