/**
 * CRON: Stacks keeper
 *
 * Completes Stacks→Base Megapot purchases server-side: claims
 * chainhook-confirmed rows and runs the settlement stages (float check →
 * optional CCTP relay → classic Megapot purchase → receipt-verified
 * completion). Mirrors the xLayer/Season keeper house pattern:
 *
 * Fail-closed gates:
 *   - CRON_SECRET bearer auth when configured
 *   - STACKS_KEEPER_ENABLED=true + STACKS_KEEPER_PRIVATE_KEY (fallback
 *     STACKS_BRIDGE_OPERATOR_KEY) inside the processor
 *
 * Every transition is persisted to agent_run_events (source 'stacks-keeper');
 * the latest run replays via GET /api/agent/stacks/latest-run.
 *
 * vercel.json:
 * { "path": "/api/crons/stacks-keeper", "schedule": "0 0 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { runStacksKeeper } from '@/services/jobs/stacksKeeperProcessor';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runStacksKeeper();
    logger.info('[StacksKeeper] Cron complete', {
      attempted: result.attempted,
      reason: result.reason,
      settled: result.settlements.filter((s) => s.complete).length,
    });
    return NextResponse.json({ ok: true, keeper: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[StacksKeeper] Cron failed:', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
