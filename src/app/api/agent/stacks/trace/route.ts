/**
 * GET /api/agent/stacks/trace?sourceTxId=<normalized stacks tx id>
 *
 * Per-purchase operator trace: replays every keeper journal entry whose
 * structured `tool_id` equals the requested source tx id (the join key the
 * keeper writes on settlement entries). Read-only, keyless, and truthful
 * about absence — an unknown tx returns an empty trace, never a fabricated
 * timeline. Powers the "Watch the operator settle this purchase" deep link
 * from the purchase-status page.
 *
 * Chainhook tx ids are recorded normalized (no 0x prefix); the endpoint
 * normalizes input so either form resolves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { ensureAgentRunEventsTable } from '@/lib/db/repositories/agentRunRepository';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await ensureAgentRunEventsTable();

    const raw = req.nextUrl.searchParams.get('sourceTxId')?.trim() ?? '';
    if (!raw) {
      return NextResponse.json({ error: 'sourceTxId is required' }, { status: 400 });
    }

    // Chainhook writes normalize away the 0x prefix; accept both spellings.
    const normalized = raw.startsWith('0x') ? raw.slice(2) : raw;
    if (!/^[0-9a-fA-F]{8,128}$/.test(normalized)) {
      return NextResponse.json({ error: 'Invalid sourceTxId format' }, { status: 400 });
    }

    const result = await sql`
      SELECT id, session_id, kind, label, detail, tool_id, tx_hash, created_at
      FROM agent_run_events
      WHERE source = 'stacks-keeper'
        AND tool_id = ${normalized}
      ORDER BY created_at ASC;
    `;

    // Group into runs so the UI can show which tick handled the purchase
    // (a rejected settlement is retried by a later session — the trace
    // should show that history, oldest first).
    const runs = new Map<string, Array<Record<string, unknown>>>();
    for (const row of result.rows) {
      const sessionId = row.session_id as string;
      if (!runs.has(sessionId)) runs.set(sessionId, []);
      runs.get(sessionId)!.push({
        id: row.id,
        kind: row.kind,
        label: row.label,
        detail: row.detail,
        txHash: row.tx_hash,
        createdAt: Number(row.created_at),
      });
    }

    const trace = [...runs.entries()].map(([sessionId, entries]) => ({
      sessionId,
      entries,
    }));

    return NextResponse.json({
      ok: true,
      sourceTxId: normalized,
      // found=false with an empty trace is the honest "no operator has
      // touched this purchase (yet)" answer — the purchase row is the
      // source of truth for lifecycle state, this is the audit trail.
      found: trace.length > 0,
      runs: trace,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[StacksTrace] Read failed:', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
