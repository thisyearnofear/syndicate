-- Migration: Add deposit tx hash to syndicate_members
--
-- syndicateRepository.addMember has always written tx_hash (the join action
-- in /api/syndicates requires a verified on-chain USDC transfer), but no
-- migration added the column, so the write depended on schema drift.
-- This reconciles the canonical schema with the application contract.

ALTER TABLE syndicate_members
  ADD COLUMN IF NOT EXISTS tx_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_syndicate_members_tx_hash
  ON syndicate_members(tx_hash);

COMMENT ON COLUMN syndicate_members.tx_hash IS
  'On-chain deposit transaction hash, verified during the join action';
