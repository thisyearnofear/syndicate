/**
 * CRON: Process Purchase Jobs
 *
 * Drains the durable purchase_jobs queue AND the virtuals_tasks table.
 * Triggered by Vercel Cron daily at midnight.
 *
 * vercel.json:
 * { "path": "/api/crons/process-jobs", "schedule": "0 0 * * *" }
 *
 * Two responsibilities:
 * 1. drainJobQueue() — process bridge events + ticket mints (existing).
 * 2. drainVirtualsTasks() — invoke the Syndicate Strategist (Virtuals
 *    ACP) on tasks whose `next_execution_at` is due. Each call is
 *    idempotent and bounded by the kill switch (`is_active` on the task
 *    record) and the per-task `lastExecutedAt` reschedule.
 */

import { NextRequest, NextResponse } from 'next/server';
import { drainJobQueue } from '@/services/jobs/purchaseJobProcessor';
import { drainVirtualsTasks } from '@/services/jobs/virtualsJobProcessor';
import { ensurePurchaseJobsTable } from '@/lib/db/repositories/purchaseJobRepository';
import { ensureVirtualsTasksTable } from '@/lib/db/repositories/virtualsTaskRepository';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  // Verify Vercel Cron authorization
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensurePurchaseJobsTable();
    await ensureVirtualsTasksTable();

    const [purchaseResult, virtualsResult] = await Promise.all([
      drainJobQueue(),
      drainVirtualsTasks(),
    ]);

    logger.info('[ProcessJobs] Cron complete', {
      purchase: purchaseResult,
      virtuals: virtualsResult,
    });

    return NextResponse.json({
      ok: true,
      purchase: purchaseResult,
      virtuals: virtualsResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[ProcessJobs] Cron failed:', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
