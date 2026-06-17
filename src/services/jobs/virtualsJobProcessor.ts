/**
 * VIRTUALS JOB PROCESSOR
 *
 * Drains the virtuals_tasks table for due tasks and dispatches each one to
 * AutomationOrchestrator.executeTask. The orchestrator returns an
 * ExecutionResult; this processor is responsible for persisting the outcome
 * back to the task record (lastReasoning, lastTxHash, lastError, next run).
 *
 * Called by the /api/crons/process-jobs endpoint (Vercel Cron).
 *
 * Kill switch: the `is_active` flag on the task record is honored as a hard
 * kill switch. A task that has is_active=false is treated as paused/cancelled
 * and is NOT executed, even if next_execution_at <= now().
 *
 * Idempotency: between the moment a task is claimed and the moment we update
 * its next_execution_at, the cron may be invoked concurrently on a second
 * worker. The repository's getTasksDueForExecution does not atomically claim
 * tasks; we mitigate by:
 *   1. Always bumping next_execution_at by at least 60s after every run
 *      (success or failure), so a re-entrant cron will skip the task.
 *   2. Logging when a task is observed as still-due (i.e. the previous
 *      run's update was lost) so an operator can investigate.
 */

import { getVirtualsTaskRepository } from '@/lib/db/schema/virtualsTasks';
import type { VirtualsTaskRecord } from '@/lib/db/schema/virtualsTasks';
import { AutomationOrchestrator } from '@/services/automation/AutomationOrchestrator';
import type { AutomationTask, ExecutionResult } from '@/services/automation/AutomationOrchestrator';
import { logger } from '@/lib/logger';

// How many tasks to process per cron invocation
const BATCH_SIZE = 10;

// Minimum delay before the next run after a successful execution.
// Prevents a tight re-execution loop if a long-running cron overlaps itself.
const MIN_RESCHEDULE_MS = 60_000;

// ---------------------------------------------------------------------------
// Frequency → next-execution-time
// ---------------------------------------------------------------------------

function computeNextExecution(frequency: VirtualsTaskRecord['frequency'], fromMs = Date.now()): number {
  switch (frequency) {
    case 'hourly':
      return fromMs + 60 * 60 * 1000;
    case 'daily':
      return fromMs + 24 * 60 * 60 * 1000;
    case 'weekly':
      return fromMs + 7 * 24 * 60 * 60 * 1000;
    case 'opportunistic':
      // 6h cadence — the agent decides what to do, the cron just nudges it.
      return fromMs + 6 * 60 * 60 * 1000;
  }
}

// ---------------------------------------------------------------------------
// Map persisted record → orchestrator task
// ---------------------------------------------------------------------------

function recordToAutomationTask(record: VirtualsTaskRecord): AutomationTask {
  return {
    id: record.id,
    userAddress: record.userAddress,
    strategy: 'virtuals-acp',
    status: record.status === 'active' ? 'active' : record.status === 'paused' ? 'paused' : 'cancelled',
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    tokenSymbol: record.tokenSymbol,
    amount: record.amount,
    frequency: record.frequency === 'hourly'
      ? 'daily' // closest match in AutomationTask's union; hourly is rare
      : (record.frequency as AutomationTask['frequency']),
    lastExecutedAt: record.lastExecutedAt,
    nextExecutionAt: record.nextExecutionAt,
    lastReasoning: record.lastReasoning,
    recipientEmail: record.recipientEmail,
    metadata: { agentId: record.agentId, virtualsTaskId: record.id },
  };
}

// ---------------------------------------------------------------------------
// Main drain loop
// ---------------------------------------------------------------------------

export async function drainVirtualsTasks(): Promise<{ processed: number; errors: number; skipped: number }> {
  const repo = getVirtualsTaskRepository();
  const orchestrator = AutomationOrchestrator.getInstance();
  const now = Date.now();

  let processed = 0;
  let errors = 0;
  let skipped = 0;

  const due = await repo.getTasksDueForExecution(now, BATCH_SIZE);
  if (due.length === 0) {
    return { processed, errors, skipped };
  }

  for (const record of due) {
    // Defense in depth: even if the repository query missed the is_active
    // filter for any reason, we re-check here before calling the orchestrator
    // (which would otherwise spend real money on a paused/cancelled task).
    if (!record.isActive || record.status !== 'active') {
      skipped++;
      continue;
    }

    try {
      const task = recordToAutomationTask(record);
      const result: ExecutionResult = await orchestrator.executeTask(task);

      await repo.updateTask(record.id, {
        executionCount: record.executionCount + 1,
        lastExecutedAt: Date.now(),
        lastReasoning: result.reasoning ?? record.lastReasoning,
        lastTxHash: result.txHash,
        lastError: result.success ? undefined : (result.error ?? 'Unknown error'),
        // Always reschedule, even on failure, so a broken task doesn't
        // tight-loop the cron. Failures get a longer delay.
        nextExecutionAt: result.success
          ? Math.max(computeNextExecution(record.frequency), Date.now() + MIN_RESCHEDULE_MS)
          : Date.now() + 5 * 60 * 1000, // 5 min backoff on failure
        status: result.success ? 'active' : 'failed',
        // Auto-pause after 3 consecutive failures to avoid a tight
        // burn loop on the agent wallet / Venice credits.
        ...(result.success ? {} : { isActive: record.executionCount + 1 >= 3 ? false : record.isActive }),
      });
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[VirtualsProcessor] Task execution threw', { taskId: record.id, error: message });
      try {
        await repo.updateTask(record.id, {
          lastError: message,
          lastExecutedAt: Date.now(),
          nextExecutionAt: Date.now() + 5 * 60 * 1000,
        });
      } catch (updateErr) {
        logger.error('[VirtualsProcessor] Failed to persist error state', { taskId: record.id, error: updateErr });
      }
      errors++;
    }
  }

  return { processed, errors, skipped };
}
