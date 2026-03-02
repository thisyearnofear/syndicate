INSERT INTO purchase_statuses (
  stacks_tx_id,
  source_tx_id,
  source_chain,
  status,
  base_tx_id,
  recipient_base_address,
  updated_at
)
SELECT
  c.stacks_tx_id,
  c.stacks_tx_id,
  'stacks',
  'complete',
  c.base_tx_id,
  c.evm_address,
  NOW()
FROM cross_chain_purchases c
WHERE c.stacks_tx_id IS NOT NULL
  AND c.base_tx_id IS NOT NULL
ON CONFLICT (stacks_tx_id)
DO UPDATE SET
  source_tx_id = EXCLUDED.source_tx_id,
  source_chain = EXCLUDED.source_chain,
  status = EXCLUDED.status,
  base_tx_id = EXCLUDED.base_tx_id,
  recipient_base_address = EXCLUDED.recipient_base_address,
  updated_at = NOW();
