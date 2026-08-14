/**
 * CRON: Season keeper
 *
 * Keeps the Season of Tickets campaign moving between visitors: frees
 * inactive seats (the tontine retention rule) and expires call rounds
 * that passed their cutoff without a settlement. DB housekeeping only —
 * it signs nothing and holds no keys; settlement is receipt-driven via
 * POST /api/season/rounds/[id]/settle.
 *
 * Gates (both fail closed, mirroring xlayer-keeper):
 *   - CRON_SECRET bearer auth when configured
 *   - SEASON_KEEPER_ENABLED=true inside the processor
 *
 * Every transition is persisted to agent_run_events (source
 * 'season-keeper'); the latest run replays publicly at
 * GET /api/agent/season/latest-run.
 *
 * vercel.json:
 * { "path": "/api/crons/season-keeper", "schedule": "0 0 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { runSeasonKeeper } from '@/services/jobs/seasonKeeperProcessor';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSeasonKeeper();
    logger.info('[SeasonKeeper] Cron complete', {
      attempted: result.attempted,
      reason: result.reason,
      actions: result.actions.length,
    });
    return NextResponse.json({ ok: true, keeper: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[SeasonKeeper] Cron failed:', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
