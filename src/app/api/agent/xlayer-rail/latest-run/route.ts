/**
 * PUBLIC REPLAY: latest X Layer ticket-rail run
 *
 * Same contract as /api/agent/stacks/latest-run: anyone can see the
 * operator's most recent rail settlement without connecting a wallet.
 * Read-only over agent_run_events (source 'xlayer-rail'); holds no keys.
 */

import { NextResponse } from 'next/server';
import { ensureAgentRunEventsTable, getLatestAgentRunSessionBySource } from '@/lib/db/repositories/agentRunRepository';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureAgentRunEventsTable();
    const session = await getLatestAgentRunSessionBySource('xlayer-rail');
    if (!session) {
      return NextResponse.json({
        ok: true,
        run: null,
        note: 'No X Layer rail run recorded yet.',
      });
    }
    return NextResponse.json({ ok: true, run: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
