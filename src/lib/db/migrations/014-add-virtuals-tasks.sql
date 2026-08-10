-- Migration: Add virtuals_tasks table
--
-- Canonical home for the Virtuals ACP automation task schema. This DDL was
-- previously created lazily at runtime by virtualsTaskRepository
-- (ensureVirtualsTasksTable); it matches the live production table exactly.
-- Runtime code must not create schema — see docs/OPERATIONS.md.

CREATE TABLE IF NOT EXISTS virtuals_tasks (
  id                UUID PRIMARY KEY,
  agent_id          TEXT        NOT NULL,
  user_address      VARCHAR(42) NOT NULL,
  frequency         TEXT        NOT NULL,
  amount            NUMERIC(78) NOT NULL,
  token_symbol      TEXT        NOT NULL,
  recipient_email   TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'active',
  execution_count   INTEGER     NOT NULL DEFAULT 0,
  last_executed_at  BIGINT,
  next_execution_at BIGINT      NOT NULL,
  last_reasoning    TEXT,
  last_tx_hash      VARCHAR(66),
  last_error        TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        BIGINT      NOT NULL,
  updated_at        BIGINT      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_virtuals_tasks_due
  ON virtuals_tasks (next_execution_at)
  WHERE is_active = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_virtuals_tasks_agent_user
  ON virtuals_tasks (agent_id, user_address);

COMMENT ON TABLE virtuals_tasks IS 'Virtuals ACP recurring-automation tasks (persisted schedules with execution state)';
