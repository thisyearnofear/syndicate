-- Migration: Add governance tables for DAO voting

-- Governance proposals
CREATE TABLE IF NOT EXISTS governance_proposals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pool_id UUID NOT NULL REFERENCES syndicate_pools(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'ticket_purchase',
    'fund_allocation',
    'member_add',
    'member_remove',
    'config_change'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  proposer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'pending', 'active', 'passed', 'failed', 'executed', 'cancelled'
  )),
  for_votes INTEGER DEFAULT 0,
  against_votes INTEGER DEFAULT 0,
  abstain_votes INTEGER DEFAULT 0,
  quorum_required INTEGER NOT NULL,
  proposal_data JSONB,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  executed_at BIGINT,
  execution_tx_hash TEXT
);

-- Governance votes
CREATE TABLE IF NOT EXISTS governance_votes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  proposal_id TEXT NOT NULL REFERENCES governance_proposals(id) ON DELETE CASCADE,
  voter TEXT NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('yes', 'no', 'abstain')),
  reason TEXT,
  created_at BIGINT NOT NULL,
  UNIQUE(proposal_id, voter)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposals_pool_id ON governance_proposals(pool_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON governance_proposals(status);
CREATE INDEX IF NOT EXISTS idx_votes_proposal_id ON governance_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON governance_votes(voter);

-- Comments
COMMENT ON TABLE governance_proposals IS 'DAO proposals for syndicate governance';
COMMENT ON TABLE governance_votes IS 'Votes on governance proposals';
