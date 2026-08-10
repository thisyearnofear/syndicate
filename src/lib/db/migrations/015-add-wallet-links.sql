-- Migration: Add wallet_links table
--
-- Canonical home for the cross-chain wallet linkage schema. This DDL was
-- previously applied only via the one-off scripts/migrate-wallet-links.ts;
-- it matches the live production table exactly. Runtime code must not
-- create schema — see docs/OPERATIONS.md.

CREATE TABLE IF NOT EXISTS wallet_links (
  source_wallet VARCHAR(255) NOT NULL,
  source_chain  VARCHAR(50)  NOT NULL,
  evm_address   VARCHAR(42)  NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_wallet, source_chain)
);

COMMENT ON TABLE wallet_links IS 'Cross-chain wallet linkage (Stacks/NEAR/TON wallet -> derived EVM address)';
