/**
 * STACKS KEEPER PROCESSOR — server-side settlement loop (cron)
 *
 * Drains pending Stacks purchases: claims purchase_statuses rows left in
 * 'confirmed_stacks' by the chainhook and runs the settlement stages
 * (float check → optional CCTP relay → Megapot purchase → receipt-verified
 * completion). Mirrors the xLayer/Season keeper house pattern:
 *
 *   - Fail-closed: without STACKS_KEEPER_ENABLED=true and a valid keeper key
 *     (STACKS_KEEPER_PRIVATE_KEY, fallback STACKS_BRIDGE_OPERATOR_KEY) the
 *     route reports attempted:false and records nothing.
 *   - Receipt-verified: the purchase_statuses row flips to 'complete' only
 *     after verifyTicketPurchaseReceipt attributes real Megapot logs to the
 *     recipient. Never fabricates a tx hash.
 *   - Journaled: every transition persists to agent_run_events (source
 *     'stacks-keeper') for public replay.
 *
 * CCTP note: USDCx peg-out settles native USDC on ETHEREUM (xReserve). A
 * complete end-to-end CCTP relay needs the MessageSent message bytes from the
 * Ethereum leg; the chainhook only gives us the Stacks tx. The keeper
 * therefore operates on the float model by default (treasury keeps the
 * purchase token topped up on the keeper wallet) and accepts CCTP message
 * payloads when the funds leg routes through CCTP. Stacks tx hashes are
 * recorded as source evidence only — never as Base completion.
 *
 * The settlement service owns viem client construction (the repo carries two
 * viem type instances; client-typed values do not cross module boundaries).
 */

/**
 * Short random hex suffix for session/id salt. Deliberately Math.random, not
 * node:crypto — this module is client-reachable via AutomationOrchestrator's
 * dynamic import, and a node builtin here breaks the browser webpack build.
 * Uniqueness (not unpredictability) is the requirement for these identifiers.
 */
const randomHexId = (bytes = 3): string =>
  Math.floor(Math.random() * 16 ** (bytes * 2))
    .toString(16)
    .padStart(bytes * 2, '0');
import {
  getStacksKeeperChainId,
  getStacksKeeperPrivateKey,
  isStacksKeeperEnabled,
} from '@/config/stacksKeeper';
import {
  settleStacksPurchase,
  type SettlementResult,
  type StackSettlementInput,
} from '@/services/stacks/stacksSettlementService';
import {
  claimPendingStacksPurchases,
  requeueFailedSettlement,
} from '@/lib/db/repositories/purchaseStatusRepository';
import {
  appendAgentRunEvent,
  ensureAgentRunEventsTable,
} from '@/lib/db/repositories/agentRunRepository';
import { logger } from '@/lib/logger';

const MAX_SETTLEMENTS_PER_TICK = 3;

export interface StacksKeeperRunResult {
  attempted: boolean;
  reason?: string;
  sessionId?: string;
  settlements: Array<{
    sourceTxId: string;
    ok: boolean;
    complete: boolean;
    purchaseTxHash?: string;
    error?: string;
  }>;
}

interface PendingRow {
  sourceTxId: string;
  stacksTxId: string | null;
  recipientBaseAddress: string | null;
  purchaseId: number | null;
}

export async function runStacksKeeper(): Promise<StacksKeeperRunResult> {
  if (!isStacksKeeperEnabled()) {
    return {
      attempted: false,
      reason: 'Stacks keeper is not enabled (set STACKS_KEEPER_ENABLED=true).',
      settlements: [],
    };
  }

  const privateKey = getStacksKeeperPrivateKey();
  if (!privateKey) {
    return {
      attempted: false,
      reason:
        'STACKS_KEEPER_PRIVATE_KEY (or STACKS_BRIDGE_OPERATOR_KEY) is not set or malformed — keeper is fail-closed and no run was recorded.',
      settlements: [],
    };
  }

  const chainId = getStacksKeeperChainId();
  const sessionId = `stackskeeper_${Date.now()}_${randomHexId(3)}`;
  let seq = 0;

  const record = async (
    kind: 'plan' | 'execute' | 'complete' | 'fail',
    label: string,
    opts: { detail?: string; txHash?: string; toolId?: string } = {},
  ): Promise<void> => {
    try {
      await appendAgentRunEvent({
        id: `${sessionId}_${seq++}`,
        sessionId,
        kind,
        label,
        detail: opts.detail ?? null,
        // toolId carries the purchase's sourceTxId when the entry belongs to
        // one settlement — the join key for per-purchase trace deep-links.
        toolId: opts.toolId ?? null,
        txHash: opts.txHash ?? null,
        source: 'stacks-keeper',
        createdAt: Date.now(),
      });
    } catch (err) {
      // Persistence failure must not mask the on-chain outcome.
      logger.error('[StacksKeeper] Failed to persist run event', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  try {
    await ensureAgentRunEventsTable();
    await record('plan', 'Stacks keeper tick started', {
      detail: `chainId=${chainId}`,
    });

    const pending = await claimPendingStacksPurchases(MAX_SETTLEMENTS_PER_TICK);

    if (pending.length === 0) {
      await record('complete', 'No pending Stacks purchases to settle');
      return { attempted: true, sessionId, settlements: [] };
    }

    const settlements: StacksKeeperRunResult['settlements'] = [];

    for (const row of pending) {
      const label = `Settle Stacks purchase ${row.sourceTxId.slice(0, 10)}…`;
      await record('execute', label, {
        toolId: row.sourceTxId,
        detail: `recipient=${row.recipientBaseAddress ?? 'unknown'} purchaseId=${row.purchaseId ?? 'n/a'}`,
      });

      if (!row.recipientBaseAddress || !/^0x[a-fA-F0-9]{40}$/.test(row.recipientBaseAddress)) {
        const message = 'Row missing a valid recipientBaseAddress; cannot settle.';
        await record('fail', label, { toolId: row.sourceTxId, detail: message });
        settlements.push({ sourceTxId: row.sourceTxId, ok: false, complete: false, error: message });
        continue;
      }

      const ticketCount = await resolveTicketCount(row);

      const input: StackSettlementInput = {
        sourceTxId: row.sourceTxId,
        baseAddress: row.recipientBaseAddress,
        ticketCount,
        amount: 0n,
        purchaseId: row.purchaseId ?? undefined,
      };

      const result: SettlementResult = await settleStacksPurchase(input, chainId, privateKey);

      for (const stage of result.stages) {
        await record(stage.ok ? 'complete' : 'fail', `${label} · ${stage.stage}`, {
          toolId: row.sourceTxId,
          detail: stage.error ?? (stage.skipped ? 'skipped' : undefined),
          txHash: stage.txHash,
        });
      }

      if (!result.complete) {
        // Verification rejections already journaled the row as settle.rejected
        // (status 'error') inside completeSettlement; everything else is
        // requeued as settle.retryable so the next tick retries after the
        // cooldown instead of waiting out the abandoned-'settling' window.
        await requeueFailedSettlement(row.sourceTxId, result.error ?? 'unknown settlement failure');
      }

      settlements.push({
        sourceTxId: row.sourceTxId,
        ok: result.ok,
        complete: result.complete,
        purchaseTxHash: result.purchaseTxHash,
        error: result.error,
      });
    }

    const completed = settlements.filter((s) => s.complete).length;
    await record('complete', 'Stacks keeper tick finished', {
      detail: `${completed}/${settlements.length} settled`,
    });
    return { attempted: true, sessionId, settlements };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await record('fail', 'Stacks keeper tick failed', { detail: message });
    return { attempted: true, sessionId, settlements: [], reason: message };
  }
}

/**
 * Resolve the ticket count for a pending row from the authoritative chainhook
 * job payload (enqueueJob writes ticketCount + amount). Falls back to 1 — the
 * minimum legal purchase — when the payload is missing or malformed, so the
 * keeper never over-spends the float on a guess.
 */
async function resolveTicketCount(row: PendingRow): Promise<number> {
  const txId = row.stacksTxId || row.sourceTxId;
  try {
    const { getBridgeEventPayloadByTxId } = await import(
      '@/lib/db/repositories/purchaseJobRepository'
    );
    const payload = await getBridgeEventPayloadByTxId(txId);
    const count = Number((payload as { ticketCount?: unknown } | null)?.ticketCount ?? 0);
    return count > 0 ? Math.floor(count) : 1;
  } catch {
    return 1;
  }
}

/**
 * x402 entrypoint: execute an authorized auto-purchase through the same
 * receipt-verified settlement pipeline (purchase leg only — the x402
 * authorization pays for tickets on the keeper chain directly). Called by
 * stacksX402Service.executeAutoPurchase and the automation orchestrator
 * after limit checks pass.
 */
export async function executeAuthorizedPurchase(params: {
  baseAddress: string;
  ticketCount: number;
}): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (!isStacksKeeperEnabled()) {
    return {
      success: false,
      error: 'Stacks keeper is not enabled (STACKS_KEEPER_ENABLED=true required).',
    };
  }
  const privateKey = getStacksKeeperPrivateKey();
  if (!privateKey) {
    return { success: false, error: 'Keeper key not configured; execution refused.' };
  }

  const chainId = getStacksKeeperChainId();

  // No purchase_statuses row exists for an x402 task; use a namespaced
  // synthetic source id so the audit trail stays joinable and the status
  // row remains receipt-verified like every other settlement.
  const sourceTxId = `x402-${Date.now()}-${randomHexId(3)}`;

  const result = await settleStacksPurchase(
    {
      sourceTxId,
      baseAddress: params.baseAddress,
      ticketCount: params.ticketCount,
      amount: 0n,
    },
    chainId,
    privateKey,
  );

  return {
    success: result.complete,
    txHash: result.purchaseTxHash,
    error: result.error,
  };
}
