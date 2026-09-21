-- Migration: Stacks settlement keeper support.
--
-- 1) Canonical shape for purchase_statuses. The table predates the migration
--    ledger (created before 003); on existing deployments this is a no-op,
--    but fresh environments get the exact columns the repositories expect
--    (see purchaseStatusRepository.ts).
--
-- 2) Keeper indexes: the Stacks keeper claims rows left in 'confirmed_stacks'
--    by the chainhook and retries receipt-rejected settlements
--    (error LIKE 'settle.rejected:%') after a cooldown.

CREATE TABLE IF NOT EXISTS purchase_statuses (
  id                     SERIAL PRIMARY KEY,
  stacks_tx_id           TEXT,
  source_tx_id           TEXT NOT NULL,
  source_chain           TEXT NOT NULL,
  bridge_id              TEXT,
  status                 TEXT NOT NULL,
  base_tx_id             TEXT,
  recipient_base_address TEXT,
  purchase_id            INTEGER,
  error                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_statuses_stacks_tx_id
  ON purchase_statuses (stacks_tx_id);

-- Claim scan: confirmed Stacks purchases awaiting settlement.
CREATE INDEX IF NOT EXISTS idx_purchase_statuses_stacks_pending
  ON purchase_statuses (source_chain, updated_at)
  WHERE source_chain = 'stacks' AND status IN ('confirmed_stacks', 'error');

COMMENT ON TABLE purchase_statuses IS
  'Cross-chain purchase lifecycle rows; Stacks rows are driven to complete by the stacks-keeper cron after receipt verification.';
