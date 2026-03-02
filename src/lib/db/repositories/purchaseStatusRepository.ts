import { sql } from '@vercel/postgres';

export interface PurchaseStatusRecord {
  sourceTxId: string;
  sourceChain: 'stacks' | 'solana' | 'near' | 'ethereum' | 'base';
  stacksTxId?: string | null;
  bridgeId?: string | null;
  status: string;
  baseTxId?: string | null;
  recipientBaseAddress?: string | null;
  purchaseId?: number | null;
  error?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

function normalizeTxId(txId: string): string {
  return txId.startsWith('0x') ? txId.substring(2) : txId;
}

export async function upsertPurchaseStatus(record: PurchaseStatusRecord): Promise<void> {
  const normalizedSourceId = normalizeTxId(record.sourceTxId);
  const normalizedStacksId = record.stacksTxId ? normalizeTxId(record.stacksTxId) : null;

  await sql`
    INSERT INTO purchase_statuses (
      stacks_tx_id,
      source_tx_id,
      source_chain,
      bridge_id,
      status,
      base_tx_id,
      recipient_base_address,
      purchase_id,
      error,
      updated_at
    )
    VALUES (
      ${normalizedStacksId || normalizedSourceId},
      ${normalizedSourceId},
      ${record.sourceChain},
      ${record.bridgeId || null},
      ${record.status},
      ${record.baseTxId || null},
      ${record.recipientBaseAddress || null},
      ${record.purchaseId || null},
      ${record.error || null},
      NOW()
    )
    ON CONFLICT (stacks_tx_id)
    DO UPDATE SET
      source_tx_id = EXCLUDED.source_tx_id,
      source_chain = EXCLUDED.source_chain,
      bridge_id = EXCLUDED.bridge_id,
      status = EXCLUDED.status,
      base_tx_id = EXCLUDED.base_tx_id,
      recipient_base_address = EXCLUDED.recipient_base_address,
      purchase_id = EXCLUDED.purchase_id,
      error = EXCLUDED.error,
      updated_at = NOW();
  `;
}

export async function getPurchaseStatusByTxId(txId: string): Promise<PurchaseStatusRecord | null> {
  const normalizedId = normalizeTxId(txId);
  let result = await sql`
    SELECT
      stacks_tx_id,
      source_tx_id,
      source_chain,
      bridge_id,
      status,
      base_tx_id,
      recipient_base_address,
      purchase_id,
      error,
      updated_at,
      created_at
    FROM purchase_statuses
    WHERE source_tx_id = ${normalizedId}
    LIMIT 1;
  `;

  if (!result.rows.length) {
    result = await sql`
      SELECT
        stacks_tx_id,
        source_tx_id,
        source_chain,
        bridge_id,
        status,
        base_tx_id,
        recipient_base_address,
        purchase_id,
        error,
        updated_at,
        created_at
      FROM purchase_statuses
      WHERE stacks_tx_id = ${normalizedId}
      LIMIT 1;
    `;
  }

  if (!result.rows.length) return null;

  const row = result.rows[0];
  return {
    sourceTxId: row.source_tx_id || row.stacks_tx_id,
    sourceChain: row.source_chain || 'stacks',
    stacksTxId: row.stacks_tx_id,
    bridgeId: row.bridge_id,
    status: row.status,
    baseTxId: row.base_tx_id,
    recipientBaseAddress: row.recipient_base_address,
    purchaseId: row.purchase_id,
    error: row.error,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export async function getPendingPurchaseStatusesByChain(sourceChain: 'solana' | 'near' | 'stacks' | 'ethereum' | 'base') {
  const result = await sql`
    SELECT
      stacks_tx_id,
      source_tx_id,
      source_chain,
      bridge_id,
      status,
      base_tx_id,
      recipient_base_address,
      purchase_id,
      error,
      updated_at,
      created_at
    FROM purchase_statuses
    WHERE source_chain = ${sourceChain}
      AND status IN ('bridging', 'broadcasting', 'confirmed_source', 'confirmed_stacks')
      AND bridge_id IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 100;
  `;

  return result.rows.map(row => ({
    sourceTxId: row.source_tx_id || row.stacks_tx_id,
    sourceChain: row.source_chain || sourceChain,
    stacksTxId: row.stacks_tx_id,
    bridgeId: row.bridge_id,
    status: row.status,
    baseTxId: row.base_tx_id,
    recipientBaseAddress: row.recipient_base_address,
    purchaseId: row.purchase_id,
    error: row.error,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  })) as PurchaseStatusRecord[];
}
