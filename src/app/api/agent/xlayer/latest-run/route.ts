/**
 * GET /api/agent/xlayer/latest-run
 *
 * Public, read-only replay of the most recent server-side operator run
 * (keeper cron). The interactive agent transcript lives in the visitor's
 * localStorage; this endpoint lets judges and strangers audit the agent's
 * plan → execute → receipt trail without a wallet.
 *
 * Returns metadata only — no keys, no permit payloads. Tx hashes link out
 * to the public explorer.
 */

import { NextResponse } from 'next/server';
import {
  ensureAgentRunEventsTable,
  getLatestAgentRunSession,
} from '@/lib/db/repositories/agentRunRepository';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureAgentRunEventsTable();
    const session = await getLatestAgentRunSession();
    if (!session) {
      return NextResponse.json({ sessionId: null, entries: [] });
    }
    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[LatestAgentRun] Read failed:', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
