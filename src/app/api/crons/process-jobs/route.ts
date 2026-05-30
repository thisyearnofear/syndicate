/**
 * CRON: Process Purchase Jobs
 *
 * Drains the durable purchase_jobs queue.
 * Triggered by Vercel Cron daily at midnight.
 *
 * vercel.json:
 * { "path": "/api/crons/process-jobs", "schedule": "0 0 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { drainJobQueue } from '@/services/jobs/purchaseJobProcessor';
import { ensurePurchaseJobsTable } from '@/lib/db/repositories/purchaseJobRepository';
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
    const result = await drainJobQueue();
    logger.info(`[ProcessJobs] Cron complete: ${result.processed} processed, ${result.errors} errors`);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[ProcessJobs] Cron failed:', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
