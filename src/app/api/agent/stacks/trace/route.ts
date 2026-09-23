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
 * Delegates to the shared source-aware trace reader (src/lib/agentRunTrace).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseTrace, TRACE_SOURCE_VALIDATORS } from '@/lib/agentRunTrace';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get('sourceTxId')?.trim() ?? '';
    if (!raw) {
      return NextResponse.json({ error: 'sourceTxId is required' }, { status: 400 });
    }

    const normalized = TRACE_SOURCE_VALIDATORS['stacks-keeper'](raw);
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid sourceTxId format' }, { status: 400 });
    }

    const trace = await getPurchaseTrace('stacks-keeper', normalized);
    return NextResponse.json({ ok: true, ...trace });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[StacksTrace] Read failed:', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
