-- Syndicate Pools & Vaults Schema Migration
-- Phase 2: Week 1-2 Foundation
-- Privacy-ready architecture (fields unused until Phase 3)

-- ============================================================================
-- SYNDICATE POOLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS syndicate_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  coordinator_address VARCHAR(255) NOT NULL,
  members_count INTEGER DEFAULT 0,
  total_pooled_usdc NUMERIC(20, 6) DEFAULT 0,
  cause_allocation_percent INTEGER DEFAULT 0 CHECK (cause_allocation_percent >= 0 AND cause_allocation_percent <= 100),
  
  -- Privacy fields (Phase 3 - unused for now)
  privacy_enabled BOOLEAN DEFAULT FALSE,
  pool_public_key BYTEA,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_cause_allocation CHECK (cause_allocation_percent >= 0 AND cause_allocation_percent <= 100)
);

-- Indexes for syndicate_pools
CREATE INDEX IF NOT EXISTS idx_syndicate_pools_coordinator ON syndicate_pools(coordinator_address);
CREATE INDEX IF NOT EXISTS idx_syndicate_pools_active ON syndicate_pools(is_active);
CREATE INDEX IF NOT EXISTS idx_syndicate_pools_created ON syndicate_pools(created_at);

-- ============================================================================
-- SYNDICATE MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS syndicate_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES syndicate_pools(id) ON DELETE CASCADE,
  member_address VARCHAR(255) NOT NULL,
  amount_usdc NUMERIC(20, 6) NOT NULL,
  
  -- Privacy fields (Phase 3 - unused for now)
  amount_commitment BYTEA,
  
  -- Timestamps
  joined_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  
  -- Constraints
  UNIQUE(pool_id, member_address),
  CONSTRAINT positive_amount CHECK (amount_usdc > 0)
);

-- Indexes for syndicate_members
CREATE INDEX IF NOT EXISTS idx_syndicate_members_pool ON syndicate_members(pool_id);
CREATE INDEX IF NOT EXISTS idx_syndicate_members_address ON syndicate_members(member_address);
CREATE INDEX IF NOT EXISTS idx_syndicate_members_joined ON syndicate_members(joined_at);

-- ============================================================================
-- VAULT DEPOSITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS vault_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id VARCHAR(255) NOT NULL,
  user_address VARCHAR(255) NOT NULL,
  amount_usdc NUMERIC(20, 6) NOT NULL,
  vault_protocol VARCHAR(50) NOT NULL CHECK (vault_protocol IN ('aave', 'morpho', 'spark')),
  yield_accrued NUMERIC(20, 6) DEFAULT 0,
  
  -- Privacy fields (Phase 3 - unused for now)
  encrypted_yield_amount BYTEA,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_yield_update BIGINT,
  
  -- Constraints
  CONSTRAINT positive_deposit CHECK (amount_usdc > 0),
  CONSTRAINT non_negative_yield CHECK (yield_accrued >= 0)
);

-- Indexes for vault_deposits
CREATE INDEX IF NOT EXISTS idx_vault_deposits_user ON vault_deposits(user_address);
CREATE INDEX IF NOT EXISTS idx_vault_deposits_vault ON vault_deposits(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_deposits_protocol ON vault_deposits(vault_protocol);
CREATE INDEX IF NOT EXISTS idx_vault_deposits_active ON vault_deposits(is_active);

-- ============================================================================
-- DISTRIBUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_or_vault_id UUID NOT NULL,
  distribution_type VARCHAR(50) NOT NULL CHECK (distribution_type IN ('syndicate', 'vault', 'cause')),
  total_amount NUMERIC(20, 6) NOT NULL,
  recipients_count INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'executing', 'completed', 'failed')),
  
  -- Transaction details
  transaction_hash VARCHAR(255),
  error_message TEXT,
  
  -- Privacy fields (Phase 3 - unused for now)
  encrypted_allocations BYTEA,
  
  -- Timestamps
  created_at BIGINT NOT NULL,
  executed_at BIGINT,
  
  -- Constraints
  CONSTRAINT positive_amount CHECK (total_amount > 0),
  CONSTRAINT positive_recipients CHECK (recipients_count > 0)
);

-- Indexes for distributions
CREATE INDEX IF NOT EXISTS idx_distributions_pool_vault ON distributions(pool_or_vault_id);
CREATE INDEX IF NOT EXISTS idx_distributions_type ON distributions(distribution_type);
CREATE INDEX IF NOT EXISTS idx_distributions_status ON distributions(status);
CREATE INDEX IF NOT EXISTS idx_distributions_created ON distributions(created_at);

-- ============================================================================
-- DISTRIBUTION RECIPIENTS (for tracking individual payouts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS distribution_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  recipient_address VARCHAR(255) NOT NULL,
  amount NUMERIC(20, 6) NOT NULL,
  
  -- Privacy fields (Phase 3 - unused for now)
  encrypted_amount BYTEA,
  
  -- Status
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  transaction_hash VARCHAR(255),
  error_message TEXT,
  
  -- Timestamps
  created_at BIGINT NOT NULL,
  completed_at BIGINT,
  
  -- Constraints
  CONSTRAINT positive_recipient_amount CHECK (amount > 0)
);

-- Indexes for distribution_recipients
CREATE INDEX IF NOT EXISTS idx_distribution_recipients_dist ON distribution_recipients(distribution_id);
CREATE INDEX IF NOT EXISTS idx_distribution_recipients_address ON distribution_recipients(recipient_address);
CREATE INDEX IF NOT EXISTS idx_distribution_recipients_status ON distribution_recipients(status);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE syndicate_pools IS 'Lottery syndicate pools where users pool funds to buy tickets together';
COMMENT ON TABLE syndicate_members IS 'Members of syndicate pools with their contribution amounts';
COMMENT ON TABLE vault_deposits IS 'User deposits in DeFi vaults (Aave, Morpho, Spark) for yield-to-tickets';
COMMENT ON TABLE distributions IS 'Winnings distributions to syndicate members or vault depositors';
COMMENT ON TABLE distribution_recipients IS 'Individual recipients of a distribution with their allocated amounts';

COMMENT ON COLUMN syndicate_pools.privacy_enabled IS 'Phase 3: Enable encrypted amounts and ZK proofs';
COMMENT ON COLUMN syndicate_members.amount_commitment IS 'Phase 3: Cryptographic commitment to contribution amount';
COMMENT ON COLUMN vault_deposits.encrypted_yield_amount IS 'Phase 3: Encrypted yield balance for privacy';
COMMENT ON COLUMN distributions.encrypted_allocations IS 'Phase 3: Encrypted distribution allocations';
