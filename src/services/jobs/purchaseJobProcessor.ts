/**
 * PURCHASE JOB PROCESSOR
 *
 * Drains the durable purchase_jobs queue.
 * Called by the /api/crons/process-jobs endpoint (Vercel Cron).
 *
 * Job types:
 * - process_bridge_event: record chainhook event in DB
 * - mint_tickets: (future) explicit ticket minting after USDC arrives on Base
 *
 * Note: CCTP attestation + receiveMessage() is handled client-side via
 * the useCctpRelay hook — no server-side relayer key required.
 */

import {
  claimNextJob,
  completeJob,
  failJob,
  enqueueJob,
  jobExistsForTxId,
  type PurchaseJob,
} from '@/lib/db/repositories/purchaseJobRepository';
import { stacksDecentralizedBridge } from '@/services/bridges/stacksDecentralizedBridge';
import { captureError } from '@/lib/monitoring/captureError';

// How many jobs to process per cron invocation
const BATCH_SIZE = 10;

// ---------------------------------------------------------------------------
// Main drain loop — process up to BATCH_SIZE jobs per call
// ---------------------------------------------------------------------------

export async function drainJobQueue(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < BATCH_SIZE; i++) {
    const job = await claimNextJob();
    if (!job) break; // queue empty

    try {
      await processJob(job);
      await completeJob(job.id!);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Exponential-ish backoff: 30s, 60s, 120s, 240s, 480s
      const delay = Math.min(30 * Math.pow(2, job.attempts - 1), 480);
      await failJob(job.id!, message, delay);
      errors++;

      // Alert via Sentry only when the job has exhausted all retries
      if (job.attempts >= job.maxAttempts) {
        await captureError(err instanceof Error ? err : new Error(message), {
          level: 'fatal',
          tags: { jobType: job.jobType, jobId: String(job.id) },
          extra: { payload: job.payload, attempts: job.attempts },
        });
      }
    }
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// Dispatch to the correct handler by job type
// ---------------------------------------------------------------------------

async function processJob(job: PurchaseJob): Promise<void> {
  switch (job.jobType) {
    case 'process_bridge_event':
      await handleProcessBridgeEvent(job);
      break;
    case 'mint_tickets':
      // Placeholder — ticket minting is currently handled by the Base proxy
      console.log(`[JobProcessor] mint_tickets job ${job.id} — delegated to Base proxy`);
      break;
    default:
      throw new Error(`Unknown job type: ${job.jobType}`);
  }
}

// ---------------------------------------------------------------------------
// process_bridge_event handler
// ---------------------------------------------------------------------------

interface BridgeEventPayload {
  txId: string;
  baseAddress: string;
  ticketCount: number;
  amount: string; // bigint serialized as string
  tokenPrincipal: string;
  purchaseId?: number;
  stacksAddress?: string;
  messageHash?: string;  // CCTP message hash (if available from tx receipt)
  messageBytes?: string; // CCTP message bytes (if available from tx receipt)
}

async function handleProcessBridgeEvent(job: PurchaseJob): Promise<void> {
  const p = job.payload as unknown as BridgeEventPayload;

  // Idempotency: skip if already processed
  if (await jobExistsForTxId(p.txId) && job.attempts > 1) {
    console.log(`[JobProcessor] Bridge event ${p.txId} already processed — skipping`);
    return;
  }

  await stacksDecentralizedBridge.processBridgeEvent(
    p.txId,
    p.baseAddress,
    p.ticketCount,
    BigInt(p.amount || '0'),
    p.tokenPrincipal,
    p.purchaseId,
    p.stacksAddress
  );

  // CCTP relay (receiveMessage on Base) is handled client-side via useCctpRelay hook.
  // messageHash/messageBytes are stored in the purchase status record for the client to pick up.
}

