/**
 * PURCHASE JOB PROCESSOR
 *
 * Drains the durable purchase_jobs queue.
 * Called by the /api/crons/process-jobs endpoint (Vercel Cron).
 *
 * Job types:
 * - process_bridge_event: record chainhook event in DB + enqueue cctp_relay
 * - cctp_relay: poll Circle attestation + submit to Base MessageTransmitter
 * - mint_tickets: (future) explicit ticket minting after USDC arrives on Base
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
import { relayCctpAttestation, isAlreadyRelayed } from '@/services/bridges/cctpAttestationRelay';

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
      console.error(`[JobProcessor] Job ${job.id} (${job.jobType}) failed:`, message);
      // Exponential-ish backoff: 30s, 60s, 120s, 240s, 480s
      const delay = Math.min(30 * Math.pow(2, job.attempts - 1), 480);
      await failJob(job.id!, message, delay);
      errors++;
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
    case 'cctp_relay':
      await handleCctpRelay(job);
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

  // If we have CCTP message data, enqueue the relay job
  if (p.messageHash && p.messageBytes) {
    await enqueueJob('cctp_relay', {
      stacksTxId: p.txId,
      messageHash: p.messageHash,
      messageBytes: p.messageBytes,
      recipientBaseAddress: p.baseAddress,
    });
    console.log(`[JobProcessor] Enqueued cctp_relay for ${p.txId}`);
  }
}

// ---------------------------------------------------------------------------
// cctp_relay handler
// ---------------------------------------------------------------------------

interface CctpRelayPayload {
  stacksTxId: string;
  messageHash: string;
  messageBytes: string;
  recipientBaseAddress: string;
}

async function handleCctpRelay(job: PurchaseJob): Promise<void> {
  const p = job.payload as unknown as CctpRelayPayload;

  // Idempotency: check if already relayed on-chain
  if (await isAlreadyRelayed(p.messageHash)) {
    console.log(`[JobProcessor] CCTP message ${p.messageHash} already relayed — skipping`);
    return;
  }

  const result = await relayCctpAttestation({
    stacksTxId: p.stacksTxId,
    messageHash: p.messageHash,
    messageBytes: p.messageBytes,
    recipientBaseAddress: p.recipientBaseAddress,
  });

  if (!result.success) {
    throw new Error(result.error || 'CCTP relay failed');
  }

  console.log(`[JobProcessor] ✅ CCTP relay complete for ${p.stacksTxId}: ${result.baseTxHash}`);
}
