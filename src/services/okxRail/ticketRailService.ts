/**
 * OKX X LAYER TICKET RAIL — purchase service
 *
 * One x402-verified payment → one real Megapot ticket on Base for the
 * recipient, bought by the operator wallet and receipt-verified before the
 * row flips to complete (docs/OKX_DEV_DAY.md §4).
 *
 * Idempotency: sourceTxId = 'okx-' + sha256(paymentHeader). The x402 SDK
 * settles the USD₮0 payment only when the wrapped handler returns < 400, so
 * a replayed payment header finds the claimed purchase_statuses row and
 * returns its stored outcome instead of buying twice.
 *
 * Custody: the operator EOA is the same address that receives USD₮0 on
 * X Layer (payTo) and holds the Base USDC float. Disclosed on the listing;
 * never described as trustless.
 */

import { isAddress, type Address } from 'viem';
import {
  settleStacksPurchase,
  type SettlementResult,
  type StackSettlementInput,
} from '@/services/stacks/stacksSettlementService';
import {
  claimPurchaseIfAbsent,
  getPurchaseStatusByTxId,
  recordSourceSettlementTx,
  upsertPurchaseStatus,
  type PurchaseStatusRecord,
} from '@/lib/db/repositories/purchaseStatusRepository';
import {
  appendAgentRunEvent,
  ensureAgentRunEventsTable,
  type AgentRunKind,
} from '@/lib/db/repositories/agentRunRepository';
import {
  getOkxRailKeeperPrivateKey,
  getOkxRailPurchaseChainId,
  OKX_RAIL,
} from '@/config/okxRail';
import { CHAIN_IDS } from '@/config/index';
import { logger } from '@/lib/logger';

// Same uniqueness-only hex helper as stacksKeeperProcessor — Math.random on
// purpose: this module stays out of the client bundle but shares the repo's
// no-node:crypto rule for anything client-reachable.
const randomHexId = (bytes = 3): string =>
  Math.floor(Math.random() * 16 ** (bytes * 2))
    .toString(16)
    .padStart(bytes * 2, '0');

export const RAIL_JOURNAL_SOURCE = 'xlayer-rail';

export interface TicketRailDeps {
  settle: (
    input: StackSettlementInput,
    chainId: number,
    privateKey: string,
  ) => Promise<SettlementResult>;
  claimRow: (record: {
    sourceTxId: string;
    sourceChain: 'xlayer';
    recipientBaseAddress: string;
  }) => Promise<boolean>;
  getRow: (sourceTxId: string) => Promise<PurchaseStatusRecord | null>;
  journal: (
    kind: AgentRunKind,
    label: string,
    opts?: { detail?: string; txHash?: string; toolId?: string; chain?: string; sessionId?: string },
  ) => Promise<void>;
  persistSettlementTx?: (sourceTxId: string, txHash: string) => Promise<void>;
  /**
   * Mark the claimed row failed so replays surface the stored error. Carries
   * recipient and (when the purchase leg landed) baseTxId — upsert
   * overwrites whole rows, so dropping them would erase truthful context.
   */
  failRow?: (args: {
    sourceTxId: string;
    reason: string;
    recipientBaseAddress: string;
    baseTxId?: string;
  }) => Promise<void>;
}

export interface TicketPurchaseRequest {
  recipient?: string;
  paymentHeader: string | null;
  origin: string;
}

export interface TicketPurchaseResult {
  status: number;
  body: Record<string, unknown>;
  /** Internal: lets the route post-process the x402 settlement header. */
  sessionId: string;
  sourceTxId?: string;
}

// ---------------------------------------------------------------------------
// Payment header decoding (v2 PAYMENT-SIGNATURE / v1 X-PAYMENT)
// ---------------------------------------------------------------------------

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sourceTxIdForPaymentHeader(
  paymentHeader: string,
): Promise<string> {
  return `okx-${await sha256Hex(paymentHeader)}`;
}

/**
 * Decode the payer address from the base64 payment payload. Covers the exact
 * EVM scheme's two payload shapes: EIP-3009 (`payload.authorization.from`)
 * and Permit2 (`payload.permit2Authorization.from`). Returns null when the
 * header is absent or malformed — never throws.
 */
export function decodePayerFromPaymentHeader(
  paymentHeader: string | null,
): Address | null {
  if (!paymentHeader) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf8'),
    ) as { payload?: Record<string, unknown> };
    const payload = decoded?.payload ?? {};
    const from =
      (payload.authorization as { from?: string } | undefined)?.from ??
      (payload.permit2Authorization as { from?: string } | undefined)?.from;
    return typeof from === 'string' && isAddress(from) ? (from as Address) : null;
  } catch {
    return null;
  }
}

function explorerUrlFor(chainId: number, txHash: string): string {
  const base =
    chainId === CHAIN_IDS.BASE
      ? 'https://basescan.org'
      : 'https://sepolia.basescan.org';
  return `${base}/tx/${txHash}`;
}

function purchaseChainTag(chainId: number): string {
  return chainId === CHAIN_IDS.BASE ? 'base' : 'base_sepolia';
}

// ---------------------------------------------------------------------------
// Real deps
// ---------------------------------------------------------------------------

function realDeps(sessionId: string): Required<TicketRailDeps> {
  let seq = 0;
  const journal: Required<TicketRailDeps>['journal'] = async (kind, label, opts = {}) => {
    try {
      await appendAgentRunEvent({
        // Unique across calls into this factory — the route post-processor
        // journals into the same sessionId via a fresh realDeps(), and a
        // plain seq would collide on `${sessionId}_0`.
        id: `${opts.sessionId ?? sessionId}_${Date.now().toString(36)}_${seq++}_${randomHexId(2)}`,
        sessionId: opts.sessionId ?? sessionId,
        kind,
        label,
        detail: opts.detail ?? null,
        toolId: opts.toolId ?? null,
        txHash: opts.txHash ?? null,
        source: RAIL_JOURNAL_SOURCE,
        chain: opts.chain ?? null,
        createdAt: Date.now(),
      });
    } catch (err) {
      // Persistence failure must not mask the on-chain outcome.
      logger.error('[OkxRail] Failed to persist run event', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return {
    settle: settleStacksPurchase,
    claimRow: claimPurchaseIfAbsent,
    getRow: getPurchaseStatusByTxId,
    journal,
    persistSettlementTx: (sourceTxId, txHash) =>
      recordSourceSettlementTx(sourceTxId, 'xlayer', txHash),
    failRow: ({ sourceTxId, reason, recipientBaseAddress, baseTxId }) =>
      upsertPurchaseStatus({
        sourceTxId,
        sourceChain: 'xlayer',
        status: 'error',
        error: reason.slice(0, 500),
        recipientBaseAddress,
        baseTxId,
      }),
  };
}

// ---------------------------------------------------------------------------
// Post-settlement journaling (x402 PAYMENT-RESPONSE header)
// ---------------------------------------------------------------------------

export interface DecodedSettleResponse {
  success?: boolean;
  status?: string;
  transaction?: string;
  payer?: string;
  network?: string;
  errorReason?: string;
  errorMessage?: string;
}

/** Decode a PAYMENT-RESPONSE / X-PAYMENT-RESPONSE header. Never throws. */
export function decodePaymentResponseHeader(
  header: string | null,
): DecodedSettleResponse | null {
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as DecodedSettleResponse;
  } catch {
    return null;
  }
}

/**
 * Close the loop after the wrapped handler ran: journal the X Layer
 * settlement outcome and persist its tx hash on the purchase row. Called
 * with the FINAL response; must never change what the client receives and
 * never throw.
 */
export async function journalSettlementOutcome(args: {
  status: number;
  paymentResponseHeader: string | null;
  sourceTxId?: string;
  sessionId?: string;
  deps?: Pick<TicketRailDeps, 'journal' | 'persistSettlementTx'>;
}): Promise<void> {
  try {
    const sessionId = args.sessionId ?? `okxrail_${Date.now()}_${randomHexId(3)}`;
    const deps = { ...realDeps(sessionId), ...args.deps };
    const toolId = args.sourceTxId;

    if (args.status !== 200) return; // SDK only settles on <400 bodies.

    const settle = decodePaymentResponseHeader(args.paymentResponseHeader);
    if (settle?.success && settle.transaction) {
      await deps.journal('complete', 'Payment settled on X Layer', {
        toolId,
        txHash: settle.transaction,
        chain: 'xlayer',
        detail: `USD₮0 settlement ${settle.transaction} (${settle.network ?? OKX_RAIL.network})`,
      });
      try {
        await deps.persistSettlementTx?.(toolId ?? '', settle.transaction);
      } catch (err) {
        logger.error('[OkxRail] Failed to persist settlement tx', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      await deps.journal('fail', 'Payment settlement failed after purchase — operator absorbed 1 ticket', {
        toolId,
        chain: 'xlayer',
        detail: settle?.status ?? settle?.errorReason ?? 'no PAYMENT-RESPONSE header',
      });
    }
  } catch (err) {
    logger.error('[OkxRail] Settlement post-processing threw', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleTicketPurchase(
  request: TicketPurchaseRequest,
  deps?: Partial<TicketRailDeps>,
): Promise<TicketPurchaseResult> {
  const sessionId = `okxrail_${Date.now()}_${randomHexId(3)}`;
  const d = { ...realDeps(sessionId), ...deps };
  const chainId = getOkxRailPurchaseChainId();
  const chainTag = purchaseChainTag(chainId);

  const fail = (status: number, error: string): TicketPurchaseResult => ({
    status,
    body: { ok: false, error },
    sessionId,
  });

  // Recipient: explicit > payer decoded from the payment payload > 400.
  const explicitValid =
    typeof request.recipient === 'string' && isAddress(request.recipient);
  const payer = decodePayerFromPaymentHeader(request.paymentHeader);
  const recipientSource: 'explicit' | 'payer' | null = explicitValid
    ? 'explicit'
    : payer
      ? 'payer'
      : null;
  const recipient = explicitValid ? (request.recipient as Address) : payer;

  if (!recipient || !recipientSource) {
    return fail(400, 'recipient required (could not derive payer)');
  }

  if (!request.paymentHeader) {
    return fail(400, 'payment header required');
  }

  const sourceTxId = await sourceTxIdForPaymentHeader(request.paymentHeader);
  const journalOpts = { toolId: sourceTxId, chain: chainTag };

  try {
    await ensureAgentRunEventsTable();
  } catch {
    // Journal availability is checked lazily inside record(); continue.
  }

  await d.journal('execute', 'X Layer ticket purchase requested', {
    ...journalOpts,
    detail: `recipient=${recipient} source=${recipientSource} chainId=${chainId}`,
  });

  const privateKey = getOkxRailKeeperPrivateKey();
  if (!privateKey) {
    await d.journal('fail', 'Keeper key missing', journalOpts);
    return { status: 503, body: { ok: false, error: 'operator key not configured' }, sessionId, sourceTxId };
  }

  // Idempotency claim: only the creator of the row may purchase.
  let claimed: boolean;
  try {
    claimed = await d.claimRow({
      sourceTxId,
      sourceChain: 'xlayer',
      recipientBaseAddress: recipient,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await d.journal('fail', 'Purchase claim failed', { ...journalOpts, detail: message });
    return { status: 502, body: { ok: false, error: `claim failed: ${message}` }, sessionId, sourceTxId };
  }

  if (!claimed) {
    const row = await d.getRow(sourceTxId);
    if (row?.status === 'complete' && row.baseTxId) {
      return {
        status: 200,
        sessionId,
        sourceTxId,
        body: {
          ok: true,
          recipient: row.recipientBaseAddress ?? recipient,
          recipientSource,
          ticketCount: OKX_RAIL.ticketsPerCall,
          chainId,
          purchaseTxHash: row.baseTxId,
          explorerUrl: explorerUrlFor(chainId, row.baseTxId),
          sourceTxId,
          traceUrl: `${request.origin}/purchase-status?chain=xlayer&txId=${sourceTxId}`,
          replay: true,
        },
      };
    }
    if (row?.status === 'settling') {
      return { status: 409, body: { ok: false, error: 'purchase already in progress' }, sessionId, sourceTxId };
    }
    return {
      status: 502,
      body: { ok: false, error: `previous attempt failed: ${row?.error ?? 'unknown'}` },
      sessionId,
      sourceTxId,
    };
  }

  const result = await d.settle(
    {
      sourceTxId,
      baseAddress: recipient,
      ticketCount: OKX_RAIL.ticketsPerCall,
      amount: 0n,
      sourceChain: 'xlayer',
    },
    chainId,
    privateKey,
  );

  for (const stage of result.stages) {
    if (stage.skipped) continue; // no CCTP leg on this rail — don't journal it
    await d.journal(stage.ok ? 'complete' : 'fail', `X Layer rail · ${stage.stage}`, {
      ...journalOpts,
      txHash: stage.txHash,
      detail: stage.error ?? (stage.skipped ? 'skipped' : undefined),
    });
  }

  if (result.complete && result.purchaseTxHash) {
    await d.journal('complete', 'Ticket purchase verified on Base', {
      ...journalOpts,
      txHash: result.purchaseTxHash,
    });
    return {
      status: 200,
      sessionId,
      sourceTxId,
      body: {
        ok: true,
        recipient,
        recipientSource,
        ticketCount: OKX_RAIL.ticketsPerCall,
        chainId,
        purchaseTxHash: result.purchaseTxHash,
        explorerUrl: explorerUrlFor(chainId, result.purchaseTxHash),
        sourceTxId,
        traceUrl: `${request.origin}/purchase-status?chain=xlayer&txId=${sourceTxId}`,
      },
    };
  }

  const floatShort = result.stages.some((s) => s.stage === 'funds_leg' && !s.ok);
  const message = result.error ?? 'settlement failed';
  try {
    await d.failRow?.({
      sourceTxId,
      reason: message,
      recipientBaseAddress: recipient,
      baseTxId: result.purchaseTxHash,
    });
  } catch (err) {
    logger.error('[OkxRail] Failed to mark purchase row failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
  await d.journal('fail', 'Ticket purchase failed', { ...journalOpts, detail: message });
  return {
    status: floatShort ? 503 : 502,
    body: {
      ok: false,
      error: floatShort
        ? `operator float insufficient: ${message}`
        : `purchase failed: ${message}`,
    },
    sessionId,
    sourceTxId,
  };
}
