/**
 * Shared per-purchase operator trace read.
 *
 * agent_run_events entries carry a structured tool_id (the purchase's
 * sourceTxId) written by each keeper/rail. This module whitelists the
 * readable sources and per-source id validation, then groups matching
 * entries into runs so a retried settlement shows its history.
 */

import { sql } from '@vercel/postgres';
import { ensureAgentRunEventsTable } from '@/lib/db/repositories/agentRunRepository';

/** Returns the normalized tool_id to query, or null when invalid. */
export const TRACE_SOURCE_VALIDATORS: Record<string, (raw: string) => string | null> = {
  // Chainhook tx ids are recorded normalized (no 0x prefix); accept both.
  'stacks-keeper': (raw) => {
    const normalized = raw.startsWith('0x') ? raw.slice(2) : raw;
    return /^[0-9a-fA-F]{8,128}$/.test(normalized) ? normalized : null;
  },
  // Rail ids are 'okx-' + sha256(payment header) hex, minted server-side.
  'xlayer-rail': (raw) => (/^okx-[0-9a-f]{64}$/.test(raw) ? raw : null),
};

export interface TraceEntry {
  id: string;
  kind: string;
  label: string;
  detail: string | null;
  txHash: string | null;
  chain: string | null;
  createdAt: number;
}

export interface PurchaseTrace {
  sourceTxId: string;
  /** found=false with empty runs is the honest "no operator has touched this purchase (yet)". */
  found: boolean;
  runs: Array<{ sessionId: string; entries: TraceEntry[] }>;
}

export async function getPurchaseTrace(
  source: keyof typeof TRACE_SOURCE_VALIDATORS,
  normalizedToolId: string,
): Promise<PurchaseTrace> {
  await ensureAgentRunEventsTable();
  const result = await sql`
    SELECT id, session_id, kind, label, detail, tool_id, tx_hash, chain, created_at
    FROM agent_run_events
    WHERE source = ${source}
      AND tool_id = ${normalizedToolId}
    ORDER BY created_at ASC;
  `;

  const runs = new Map<string, TraceEntry[]>();
  for (const row of result.rows) {
    const sessionId = row.session_id as string;
    if (!runs.has(sessionId)) runs.set(sessionId, []);
    runs.get(sessionId)!.push({
      id: row.id as string,
      kind: row.kind as string,
      label: row.label as string,
      detail: row.detail as string | null,
      txHash: row.tx_hash as string | null,
      chain: (row.chain as string | null) ?? null,
      createdAt: Number(row.created_at),
    });
  }

  return {
    sourceTxId: normalizedToolId,
    found: runs.size > 0,
    runs: [...runs.entries()].map(([sessionId, entries]) => ({ sessionId, entries })),
  };
}
