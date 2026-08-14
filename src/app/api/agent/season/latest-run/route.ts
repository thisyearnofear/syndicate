/**
 * GET /api/agent/season/latest-run
 *
 * Public, read-only replay of the most recent season-keeper run
 * (agent_run_events, source 'season-keeper'). Lets judges and strangers
 * audit the tontine housekeeping — freed seats, expired rounds — without
 * running the keeper themselves. Mirrors /api/agent/xlayer/latest-run.
 *
 * Metadata only — the season keeper holds no keys and signs nothing.
 */

import { NextResponse } from 'next/server';
import {
  ensureAgentRunEventsTable,
  getLatestAgentRunSessionBySource,
} from '@/lib/db/repositories/agentRunRepository';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureAgentRunEventsTable();
    const session = await getLatestAgentRunSessionBySource('season-keeper');
    if (!session) {
      return NextResponse.json({ sessionId: null, entries: [] });
    }
    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[SeasonLatestRun] Read failed:', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
