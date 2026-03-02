CREATE TABLE IF NOT EXISTS cross_chain_purchases (
  id BIGSERIAL PRIMARY KEY,
  source_chain TEXT NOT NULL,
  stacks_address TEXT,
  evm_address TEXT,
  stacks_tx_id TEXT,
  base_tx_id TEXT,
  ticket_count INTEGER NOT NULL,
  purchase_timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cross_chain_purchases_stacks_address_idx
  ON cross_chain_purchases (stacks_address);

CREATE INDEX IF NOT EXISTS cross_chain_purchases_purchase_timestamp_idx
  ON cross_chain_purchases (purchase_timestamp DESC);
