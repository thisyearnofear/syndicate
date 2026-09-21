/**
 * PUBLIC REPLAY: latest Stacks keeper run
 *
 * Same contract as /api/agent/xlayer/latest-run and
 * /api/agent/season/latest-run: anyone (judges, users, auditors) can see the
 * operator's most recent settlement run without connecting a wallet.
 * Read-only over agent_run_events (source 'stacks-keeper'); holds no keys.
 */

import { NextResponse } from 'next/server';
import { ensureAgentRunEventsTable, getLatestAgentRunSessionBySource } from '@/lib/db/repositories/agentRunRepository';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureAgentRunEventsTable();
    const session = await getLatestAgentRunSessionBySource('stacks-keeper');
    if (!session) {
      return NextResponse.json({
        ok: true,
        run: null,
        note: 'No Stacks keeper run recorded yet.',
      });
    }
    return NextResponse.json({ ok: true, run: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
