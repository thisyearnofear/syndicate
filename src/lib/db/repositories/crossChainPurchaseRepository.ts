import { sql } from '@vercel/postgres';

export interface CrossChainPurchaseRecord {
  sourceChain: 'stacks' | 'solana' | 'near' | 'ethereum' | 'base';
  stacksAddress?: string | null;
  evmAddress?: string | null;
  stacksTxId?: string | null;
  baseTxId?: string | null;
  ticketCount: number;
  purchaseTimestamp?: string;
}

export async function insertCrossChainPurchase(record: CrossChainPurchaseRecord): Promise<void> {
  await sql`
    INSERT INTO cross_chain_purchases (
      source_chain,
      stacks_address,
      evm_address,
      stacks_tx_id,
      base_tx_id,
      ticket_count,
      purchase_timestamp
    )
    VALUES (
      ${record.sourceChain},
      ${record.stacksAddress || null},
      ${record.evmAddress || null},
      ${record.stacksTxId || null},
      ${record.baseTxId || null},
      ${record.ticketCount},
      ${record.purchaseTimestamp || new Date().toISOString()}
    );
  `;
}

export async function getCrossChainPurchasesByStacksAddress(stacksAddress: string): Promise<CrossChainPurchaseRecord[]> {
  const result = await sql`
    SELECT
      source_chain,
      stacks_address,
      evm_address,
      stacks_tx_id,
      base_tx_id,
      ticket_count,
      purchase_timestamp
    FROM cross_chain_purchases
    WHERE stacks_address = ${stacksAddress}
    ORDER BY purchase_timestamp DESC;
  `;

  return result.rows.map(row => ({
    sourceChain: row.source_chain,
    stacksAddress: row.stacks_address,
    evmAddress: row.evm_address,
    stacksTxId: row.stacks_tx_id,
    baseTxId: row.base_tx_id,
    ticketCount: Number(row.ticket_count),
    purchaseTimestamp: row.purchase_timestamp,
  }));
}

export async function getAllCrossChainPurchases(): Promise<CrossChainPurchaseRecord[]> {
  const result = await sql`
    SELECT
      source_chain,
      stacks_address,
      evm_address,
      stacks_tx_id,
      base_tx_id,
      ticket_count,
      purchase_timestamp
    FROM cross_chain_purchases
    ORDER BY purchase_timestamp DESC;
  `;

  return result.rows.map(row => ({
    sourceChain: row.source_chain,
    stacksAddress: row.stacks_address,
    evmAddress: row.evm_address,
    stacksTxId: row.stacks_tx_id,
    baseTxId: row.base_tx_id,
    ticketCount: Number(row.ticket_count),
    purchaseTimestamp: row.purchase_timestamp,
  }));
}

export async function getCrossChainPurchaseByStacksTxId(stacksTxId: string): Promise<CrossChainPurchaseRecord | null> {
  const normalized = stacksTxId.startsWith('0x') ? stacksTxId.slice(2) : stacksTxId;
  const result = await sql`
    SELECT
      source_chain,
      stacks_address,
      evm_address,
      stacks_tx_id,
      base_tx_id,
      ticket_count,
      purchase_timestamp
    FROM cross_chain_purchases
    WHERE stacks_tx_id = ${normalized}
    LIMIT 1;
  `;
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    sourceChain: row.source_chain,
    stacksAddress: row.stacks_address,
    evmAddress: row.evm_address,
    stacksTxId: row.stacks_tx_id,
    baseTxId: row.base_tx_id,
    ticketCount: Number(row.ticket_count),
    purchaseTimestamp: row.purchase_timestamp,
  };
}
