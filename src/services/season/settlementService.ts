/**
 * SEASON — CALL-THE-POT SETTLEMENT SERVICE
 *
 * Orchestrates settlement of a call-the-pot round AFTER the coordinator (or
 * the winning member) has executed the two real purchases on-chain:
 *
 *   1. chest × (1 − d) of tickets to the caller's own address
 *   2. chest × d of tickets to the coordinator's pooled entry (survivor bonus)
 *
 * This service never moves funds and never simulates hashes. It verifies
 * both receipts on the season's chain (megapotReceipts.ts), checks the
 * winning bid is the caller, then records the state transition
 * (round.settled, bid won/lost, seat freed, cuts renormalized).
 *
 * The settlement endpoint is the journaling point — identical honesty
 * pattern to POST /api/syndicates/prizes (receipt-verified, never
 * fabricated).
 */

import {
  getCallRoundById,
  getCrewById,
  getSeasonById,
  listRoundBids,
  settleCallRound,
  appendSeasonEvent,
} from '@/lib/db/repositories/seasonRepository';
import { verifyTicketPurchaseReceipt } from './megapotReceipts';
import { logger } from '@/lib/logger';

export interface SettleResult {
  ok: boolean;
  error?: string;
  roundId?: string;
  winningBidId?: string;
  verification?: Record<string, unknown>;
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export async function settleCallRoundByReceipts(params: {
  roundId: string;
  callerPayoutTxHash: string;
  crewBonusTxHash: string;
  settleTxHash?: string;
}): Promise<SettleResult> {
  const { roundId, callerPayoutTxHash, crewBonusTxHash } = params;

  for (const [label, hash] of [
    ['callerPayoutTxHash', callerPayoutTxHash],
    ['crewBonusTxHash', crewBonusTxHash],
  ] as const) {
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      return { ok: false, error: `${label} must be a 32-byte hex transaction hash` };
    }
  }

  const round = await getCallRoundById(roundId);
  if (!round) return { ok: false, error: 'Round not found' };
  if (round.status === 'settled') {
    // Idempotent replay — safe to retry after a crash between receipt
    // verification and journaling.
    return { ok: true, roundId, error: 'Already settled' };
  }
  if (round.status !== 'open' && round.status !== 'settling') {
    return { ok: false, error: `Round status ${round.status} cannot be settled` };
  }
  if (Date.parse(round.cutoffAt) > Date.now()) {
    return { ok: false, error: 'Round cutoff has not passed — settle after the auction closes' };
  }

  const crew = await getCrewById(round.crewId);
  if (!crew) return { ok: false, error: 'Crew not found' };
  const season = await getSeasonById(crew.seasonId);
  if (!season) return { ok: false, error: 'Season not found' };

  // Winner = lowest live discount at cutoff (ties broken by earlier bid —
  // the repository lists them in that order).
  const bids = await listRoundBids(round.id);
  if (bids.length === 0) return { ok: false, error: 'Round has no live bids' };
  const winningBid = bids[0];
  if (!EVM_ADDRESS.test(winningBid.bidderAddress)) {
    return { ok: false, error: 'Winning bid has an invalid bidder address' };
  }

  const chainId = season.chainId;

  // 1. Verify the caller payout: real tickets purchased TO the winner.
  const payout = await verifyTicketPurchaseReceipt({
    chainId,
    txHash: callerPayoutTxHash as `0x${string}`,
    expectedBuyer: winningBid.bidderAddress as `0x${string}`,
  });
  if (!payout.ok) {
    await appendSeasonEvent({
      id: crypto.randomUUID(),
      seasonId: season.id,
      crewId: crew.id,
      kind: 'settle.rejected',
      payload: { roundId, stage: 'caller_payout', reason: payout.reason, txHash: callerPayoutTxHash },
    });
    logger.warn('[SeasonSettle] Caller payout verification failed', { roundId, reason: payout.reason });
    return { ok: false, error: `Caller payout not verified: ${payout.reason}` };
  }

  // 2. Verify the crew bonus: real tickets purchased TO the coordinator's
  //    pooled entry (the shared claim the survivors hold).
  const bonus = await verifyTicketPurchaseReceipt({
    chainId,
    txHash: crewBonusTxHash as `0x${string}`,
    expectedBuyer: crew.coordinatorAddress as `0x${string}`,
  });
  if (!bonus.ok) {
    await appendSeasonEvent({
      id: crypto.randomUUID(),
      seasonId: season.id,
      crewId: crew.id,
      kind: 'settle.rejected',
      payload: { roundId, stage: 'crew_bonus', reason: bonus.reason, txHash: crewBonusTxHash },
    });
    logger.warn('[SeasonSettle] Crew bonus verification failed', { roundId, reason: bonus.reason });
    return { ok: false, error: `Crew bonus not verified: ${bonus.reason}` };
  }

  // 3. Both receipts verified — record the state transition.
  const verification = {
    chainId,
    discountBps: winningBid.discountBps,
    chestUsdc: round.chestSnapshotUsdc,
    callerPayout: { txHash: callerPayoutTxHash, buyer: payout.buyer, referrer: payout.referrer, ticketCount: payout.ticketCount },
    crewBonus: { txHash: crewBonusTxHash, buyer: bonus.buyer, referrer: bonus.referrer, ticketCount: bonus.ticketCount },
  };

  await settleCallRound({
    roundId,
    winningBidId: winningBid.id,
    callerPayoutTxHash,
    crewBonusTxHash,
    settleTxHash: params.settleTxHash ?? null,
    verification,
  });

  logger.info('[SeasonSettle] Round settled', {
    roundId,
    crewId: crew.id,
    winner: winningBid.bidderAddress,
    discountBps: winningBid.discountBps,
  });

  return { ok: true, roundId, winningBidId: winningBid.id, verification };
}
