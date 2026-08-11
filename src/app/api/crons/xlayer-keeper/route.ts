/**
 * CRON: X Layer keeper
 *
 * Keeps the testnet prize pool alive between visitors: opens epochs when the
 * pot clears the minimum, seeds the demo oracle, fulfills randomness, and
 * claims only when the operator won. Every action is receipt-verified before
 * being persisted to agent_run_events (the public replay source on /xlayer).
 *
 * Fail-closed: without XLAYER_KEEPER_PRIVATE_KEY (testnet-only operator key)
 * the route reports attempted:false and records nothing.
 *
 * vercel.json:
 * { "path": "/api/crons/xlayer-keeper", "schedule": "0 * * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { runXLayerKeeper } from '@/services/jobs/xlayerKeeperProcessor';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runXLayerKeeper();
    logger.info('[XLayerKeeper] Cron complete', {
      attempted: result.attempted,
      reason: result.reason,
      actions: result.actions.length,
    });
    return NextResponse.json({ ok: true, keeper: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[XLayerKeeper] Cron failed:', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
