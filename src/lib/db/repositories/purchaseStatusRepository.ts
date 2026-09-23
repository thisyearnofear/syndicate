import { sql } from '@vercel/postgres';

export interface PurchaseStatusRecord {
  sourceTxId: string;
  sourceChain: 'stacks' | 'solana' | 'near' | 'ethereum' | 'base' | 'xlayer';
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

export async function getPendingPurchaseStatusesByChain(sourceChain: 'solana' | 'near' | 'stacks' | 'ethereum' | 'base' | 'xlayer') {
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

// ============================================================================
// STACKS KEEPER — claim + in-flight helpers
// ============================================================================

/**
 * Retry cooldowns are enforced by the `updated_at` filter inside the claim
 * query below (2 min general, 30 min for abandoned 'settling' rows).
 */

export interface ClaimableStacksPurchase {
  sourceTxId: string;
  stacksTxId: string | null;
  recipientBaseAddress: string | null;
  purchaseId: number | null;
}

/**
 * Claim Stacks purchases awaiting settlement: freshly chainhook-confirmed
 * rows, settle-rejected/settle-retryable rows past their cooldown, and
 * 'settling' rows abandoned by a crashed tick. FOR UPDATE SKIP LOCKED makes
 * concurrent cron invocations safe — each row is claimed by at most one tick.
 */
export async function claimPendingStacksPurchases(
  limit: number,
): Promise<ClaimableStacksPurchase[]> {
  const result = await sql`
    WITH candidates AS (
      SELECT id
      FROM purchase_statuses
      WHERE source_chain = 'stacks'
        AND (
          status = 'confirmed_stacks'
          OR (status = 'error' AND (error LIKE 'settle.rejected:%' OR error LIKE 'settle.retryable:%'))
          OR (status = 'settling' AND updated_at < NOW() - INTERVAL '30 minutes')
        )
        AND recipient_base_address LIKE '0x%'
        AND updated_at < NOW() - INTERVAL '2 minutes'
      ORDER BY updated_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE purchase_statuses p
    SET status = 'settling',
        updated_at = NOW()
    FROM candidates c
    WHERE p.id = c.id
    RETURNING
      p.source_tx_id,
      p.stacks_tx_id,
      p.recipient_base_address,
      p.purchase_id;
  `;

  return result.rows.map((row) => ({
    sourceTxId: row.source_tx_id,
    stacksTxId: row.stacks_tx_id,
    recipientBaseAddress: row.recipient_base_address,
    purchaseId: row.purchase_id,
  }));
}

/**
 * Insert-if-absent claim for non-Stacks rails (the OKX x402 X Layer rail).
 * Returns true when this call created the row — the caller owns the
 * settlement; false means a row for this sourceTxId already exists and the
 * caller must branch on its stored status instead of purchasing again.
 */
export async function claimPurchaseIfAbsent(record: {
  sourceTxId: string;
  sourceChain: 'xlayer';
  status?: string;
  recipientBaseAddress?: string | null;
}): Promise<boolean> {
  const normalizedSourceId = normalizeTxId(record.sourceTxId);
  const result = await sql`
    INSERT INTO purchase_statuses (
      stacks_tx_id,
      source_tx_id,
      source_chain,
      status,
      recipient_base_address,
      updated_at
    )
    VALUES (
      ${normalizedSourceId},
      ${normalizedSourceId},
      ${record.sourceChain},
      ${record.status ?? 'settling'},
      ${record.recipientBaseAddress ?? null},
      NOW()
    )
    ON CONFLICT (stacks_tx_id) DO NOTHING
    RETURNING id;
  `;
  return result.rows.length > 0;
}

/**
 * Persist the source-chain payment settlement tx (X Layer USD₮0 transfer)
 * on an existing rail row. Reuses bridge_id — for x402 rails that column
 * carries the source-chain settlement hash, matching its original role as
 * "the upstream tx that paid for this purchase".
 */
export async function recordSourceSettlementTx(
  sourceTxId: string,
  sourceChain: 'xlayer',
  settlementTxHash: string,
): Promise<void> {
  const normalizedId = normalizeTxId(sourceTxId);
  await sql`
    UPDATE purchase_statuses
    SET bridge_id = ${settlementTxHash},
        updated_at = NOW()
    WHERE source_tx_id = ${normalizedId}
      AND source_chain = ${sourceChain};
  `;
}

/**
 * Legacy companion marker for rows that still flow through the old
 * bridge_id-bearing polling path (useUnifiedPurchase). Does not affect the
 * keeper claim scan, which filters on status directly.
 */
export async function markPurchaseInFlight(sourceTxId: string): Promise<void> {
  await sql`
    UPDATE purchase_statuses
    SET updated_at = NOW()
    WHERE source_tx_id = ${sourceTxId}
      AND source_chain = 'stacks';
  `;
}

/**
 * Return a claimed row to the retry pool after a settlement failure that
 * was NOT journaled as settle.rejected (e.g. float short, relay revert).
 * Keeps the original failure reason in `error` for observability.
 */
export async function requeueFailedSettlement(
  sourceTxId: string,
  reason: string,
): Promise<void> {
  await sql`
    UPDATE purchase_statuses
    SET status = 'error',
        error = ${`settle.retryable: ${reason}`.slice(0, 500)},
        updated_at = NOW()
    WHERE source_tx_id = ${sourceTxId}
      AND source_chain = 'stacks'
      AND status = 'settling';
  `;
}
