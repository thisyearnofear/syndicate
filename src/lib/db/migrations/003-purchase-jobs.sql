-- =============================================================================
-- MIGRATION 003: Purchase Jobs Queue
-- Durable job queue for cross-chain purchase pipeline steps.
-- Protects against lost purchases if the server restarts between
-- chainhook receipt and ticket minting.
-- =============================================================================

CREATE TABLE IF NOT EXISTS purchase_jobs (
  id            SERIAL PRIMARY KEY,
  job_type      TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending',
  payload       JSONB       NOT NULL DEFAULT '{}',
  attempts      INTEGER     NOT NULL DEFAULT 0,
  max_attempts  INTEGER     NOT NULL DEFAULT 5,
  last_error    TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index: only index rows that need processing (keeps index small)
CREATE INDEX IF NOT EXISTS idx_purchase_jobs_status_scheduled
  ON purchase_jobs (status, scheduled_at)
  WHERE status IN ('pending', 'failed');

-- Index for idempotency lookups by txId inside payload
CREATE INDEX IF NOT EXISTS idx_purchase_jobs_payload_txid
  ON purchase_jobs ((payload->>'txId'));

COMMENT ON TABLE purchase_jobs IS 'Durable job queue for cross-chain purchase pipeline steps (bridge event processing, CCTP relay, ticket minting)';
COMMENT ON COLUMN purchase_jobs.job_type IS 'One of: process_bridge_event, cctp_relay, mint_tickets';
COMMENT ON COLUMN purchase_jobs.status IS 'One of: pending, processing, complete, failed';
COMMENT ON COLUMN purchase_jobs.payload IS 'Job-specific data (txId, messageHash, messageBytes, etc.)';
COMMENT ON COLUMN purchase_jobs.attempts IS 'Number of processing attempts made so far';
COMMENT ON COLUMN purchase_jobs.max_attempts IS 'Maximum retries before job is permanently failed';
COMMENT ON COLUMN purchase_jobs.scheduled_at IS 'Earliest time the job should be picked up (used for exponential backoff)';
