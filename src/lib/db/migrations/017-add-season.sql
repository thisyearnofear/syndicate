-- Migration: Season of Tickets — the Tontine Pot (game-jam season layer).
--
-- Canonical design: docs/SEASON.md. This is the registry/state layer only:
-- every scored entry is a REAL on-chain Megapot purchase; these tables hold
-- the season/crew roster, seat cuts, call-the-pot auction rounds, and the
-- public event feed that powers /season.
--
-- Metadata only: no private keys, no permit payloads, no plaintext private
-- balances. Tx hashes reference public on-chain receipts.

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  draw_window_start BIGINT NOT NULL,
  draw_window_end BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'closed')),
  min_chest_usdc NUMERIC(18,6) NOT NULL DEFAULT 1,
  inactivity_draws INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);

CREATE TABLE IF NOT EXISTS season_crews (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  name TEXT NOT NULL,
  crest_accent TEXT NOT NULL DEFAULT 'play',
  kind TEXT NOT NULL CHECK (kind IN ('quick', 'syndicate')),
  syndicate_pool_id TEXT,
  coordinator_address TEXT NOT NULL,
  referrer_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_season_crews_season ON season_crews(season_id);

CREATE TABLE IF NOT EXISTS season_crew_members (
  id TEXT PRIMARY KEY,
  crew_id TEXT NOT NULL REFERENCES season_crews(id),
  member_address TEXT NOT NULL,
  seat_status TEXT NOT NULL DEFAULT 'active'
    CHECK (seat_status IN ('active', 'freed_exit', 'freed_inactive')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  freed_at TIMESTAMPTZ,
  last_contribution_draw TEXT,
  cut_bps INTEGER NOT NULL DEFAULT 0,
  join_tx_hash TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crew_member ON season_crew_members(crew_id, member_address);
CREATE INDEX IF NOT EXISTS idx_crew_members_crew ON season_crew_members(crew_id);

CREATE TABLE IF NOT EXISTS season_call_rounds (
  id TEXT PRIMARY KEY,
  crew_id TEXT NOT NULL REFERENCES season_crews(id),
  chest_snapshot_usdc NUMERIC(18,6) NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cutoff_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'settling', 'settled', 'failed')),
  winning_bid_id TEXT,
  settle_tx_hash TEXT,
  caller_payout_tx_hash TEXT,
  crew_bonus_tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_call_rounds_crew ON season_call_rounds(crew_id);

CREATE TABLE IF NOT EXISTS season_bids (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES season_call_rounds(id),
  bidder_address TEXT NOT NULL,
  discount_bps INTEGER NOT NULL CHECK (discount_bps >= 100 AND discount_bps <= 5000),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revised_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'live'
    CHECK (status IN ('live', 'won', 'lost', 'void'))
);

CREATE INDEX IF NOT EXISTS idx_bids_round ON season_bids(round_id);

CREATE TABLE IF NOT EXISTS season_events (
  id TEXT PRIMARY KEY,
  season_id TEXT,
  crew_id TEXT,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_season_events_crew ON season_events(crew_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_season_events_season ON season_events(season_id, created_at DESC);

COMMENT ON TABLE seasons IS 'A season is one time-boxed competition scoped to a chain_id; never mix testnet and mainnet ladders in one season.';
COMMENT ON COLUMN season_crew_members.cut_bps IS 'Tontine cut in basis points of the crew claim; renormalized across active seats whenever a seat frees.';
COMMENT ON TABLE season_call_rounds IS 'Call-the-pot auction rounds; settlement writes tx hashes only after receipt verification.';
