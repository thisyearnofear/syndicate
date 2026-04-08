-- Migration: Add vault waitlist leads for /vaults beta testing
-- Date: 2026-04-08

CREATE TABLE IF NOT EXISTS vault_waitlist_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  wallet_address TEXT,
  source TEXT NOT NULL DEFAULT 'vaults-page',
  interest TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_waitlist_created_at
  ON vault_waitlist_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vault_waitlist_source
  ON vault_waitlist_leads(source);
