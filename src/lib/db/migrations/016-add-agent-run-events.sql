-- Migration: Persist server-side agent loop events (X Layer keeper cron).
--
-- Client transcripts live in localStorage (agentSessionTranscript), so
-- strangers and judges see nothing until they run the loop in their own
-- browser. This table is the server-side mirror: the keeper cron writes its
-- plan / execute / complete / fail transitions here, and /xlayer replays the
-- latest operator run to anyone — no wallet required.
--
-- Metadata only: no private keys, no permit payloads, no plaintext private
-- balances. Tx hashes reference public on-chain receipts.

CREATE TABLE IF NOT EXISTS agent_run_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'xlayer_testnet',
  kind TEXT NOT NULL CHECK (kind IN ('plan','plan_failed','approve','reject','execute','complete','fail','reset')),
  label TEXT NOT NULL,
  detail TEXT,
  tool_id TEXT,
  tx_hash TEXT,
  source TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_session
  ON agent_run_events(session_id);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_created_at
  ON agent_run_events(created_at DESC);
