/**
 * GET /api/agent/trace?source=<stacks-keeper|xlayer-rail>&sourceTxId=<id>
 *
 * Source-aware per-purchase operator trace. Whitelisted sources with
 * per-source id validation; returns runs of journal entries (each carrying
 * its `chain`) for the requested purchase. Read-only, keyless, truthful
 * about absence — unknown ids return an empty trace, never a fabricated
 * timeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseTrace, TRACE_SOURCE_VALIDATORS } from '@/lib/agentRunTrace';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get('source')?.trim() ?? '';
    const validator = TRACE_SOURCE_VALIDATORS[source];
    if (!validator) {
      return NextResponse.json(
        { error: `Invalid source; expected one of: ${Object.keys(TRACE_SOURCE_VALIDATORS).join(', ')}` },
        { status: 400 },
      );
    }

    const raw = req.nextUrl.searchParams.get('sourceTxId')?.trim() ?? '';
    if (!raw) {
      return NextResponse.json({ error: 'sourceTxId is required' }, { status: 400 });
    }
    const normalized = validator(raw);
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid sourceTxId format' }, { status: 400 });
    }

    const trace = await getPurchaseTrace(source, normalized);
    return NextResponse.json({ ok: true, source, ...trace });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[AgentTrace] Read failed:', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
