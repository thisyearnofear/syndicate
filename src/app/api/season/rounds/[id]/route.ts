/**
 * GET /api/season/rounds/[id] — receipt-backed historical round replay.
 *
 * A round is replayable only after the settlement journal has recorded both
 * verified Megapot purchases. Live, failed, settling, or malformed rows are
 * deliberately not presented as historical truth.
 */

import { NextResponse } from 'next/server';
import {
  ensureSeasonTables,
  getCallRoundById,
  getCrewById,
  getRoundSettlementEvent,
  getSeasonById,
  listCrewMembers,
  listHistoricalRoundBids,
} from '@/lib/db/repositories/seasonRepository';
import { apiError, apiNotFound } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

interface VerifiedPurchaseLeg {
  txHash: string;
  buyer: string;
  referrer: string | null;
  ticketCount: number;
}

interface ReplayVerification {
  chainId: number;
  discountBps: number;
  chestUsdc: string;
  callerPayout: VerifiedPurchaseLeg;
  crewBonus: VerifiedPurchaseLeg;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePurchaseLeg(value: unknown): VerifiedPurchaseLeg | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.txHash !== 'string' ||
    !TX_HASH.test(value.txHash) ||
    typeof value.buyer !== 'string' ||
    !EVM_ADDRESS.test(value.buyer) ||
    (value.referrer !== null &&
      value.referrer !== undefined &&
      (typeof value.referrer !== 'string' || !EVM_ADDRESS.test(value.referrer))) ||
    typeof value.ticketCount !== 'number' ||
    !Number.isFinite(value.ticketCount) ||
    value.ticketCount <= 0
  ) {
    return null;
  }

  return {
    txHash: value.txHash,
    buyer: value.buyer,
    referrer: (value.referrer as string | null | undefined) ?? null,
    ticketCount: value.ticketCount,
  };
}

function parseVerification(
  value: unknown,
  expectedChainId: number,
  expectedChestUsdc: string,
  expectedCallerTxHash: string,
  expectedBonusTxHash: string,
): ReplayVerification | null {
  if (!isRecord(value)) return null;

  const chainId = value.chainId;
  const discountBps = value.discountBps;
  const chestUsdc = value.chestUsdc;
  const callerPayout = parsePurchaseLeg(value.callerPayout);
  const crewBonus = parsePurchaseLeg(value.crewBonus);

  if (
    typeof chainId !== 'number' ||
    !Number.isInteger(chainId) ||
    chainId !== expectedChainId ||
    typeof discountBps !== 'number' ||
    !Number.isInteger(discountBps) ||
    discountBps < 100 ||
    discountBps > 5000 ||
    (typeof chestUsdc !== 'string' && typeof chestUsdc !== 'number') ||
    !Number.isFinite(Number(chestUsdc)) ||
    Number(chestUsdc) < 0 ||
    !callerPayout ||
    !crewBonus ||
    callerPayout.txHash.toLowerCase() !== expectedCallerTxHash.toLowerCase() ||
    crewBonus.txHash.toLowerCase() !== expectedBonusTxHash.toLowerCase() ||
    Math.abs(Number(chestUsdc) - Number(expectedChestUsdc)) > 1e-9
  ) {
    return null;
  }

  return {
    chainId,
    discountBps,
    chestUsdc: String(chestUsdc),
    callerPayout,
    crewBonus,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await ensureSeasonTables();

    const round = await getCallRoundById(id);
    if (!round) return apiNotFound('Round not found');
    if (round.status !== 'settled') {
      return apiError('Historical replay is available only for settled rounds.', 409);
    }
    if (!round.winningBidId || !round.callerPayoutTxHash || !round.crewBonusTxHash) {
      return apiError('Settled round is missing its settlement hashes.', 409);
    }

    const crew = await getCrewById(round.crewId);
    if (!crew) return apiNotFound('Crew not found');

    const season = await getSeasonById(crew.seasonId);
    if (!season) return apiNotFound('Season not found');

    const [members, bids, settlementEvent] = await Promise.all([
      listCrewMembers(crew.id),
      listHistoricalRoundBids(round.id),
      getRoundSettlementEvent(round.id),
    ]);

    if (!settlementEvent) {
      return apiError('Settled round is missing its receipt verification record.', 409);
    }

    const verification = parseVerification(
      settlementEvent.payload.verification,
      season.chainId,
      round.chestSnapshotUsdc,
      round.callerPayoutTxHash,
      round.crewBonusTxHash,
    );
    if (!verification) {
      logger.warn('[Season] Replay verification payload rejected', { roundId: round.id });
      return apiError('Settled round has an invalid receipt verification record.', 409);
    }

    const winningBid = bids.find(
      (bid) => bid.id === round.winningBidId && bid.status === 'won',
    );
    if (!winningBid) {
      return apiError('Settled round is missing its winning bid.', 409);
    }

    if (
      winningBid.discountBps !== verification.discountBps ||
      winningBid.bidderAddress.toLowerCase() !== verification.callerPayout.buyer.toLowerCase() ||
      crew.coordinatorAddress.toLowerCase() !== verification.crewBonus.buyer.toLowerCase()
    ) {
      logger.warn('[Season] Replay attribution rejected', { roundId: round.id });
      return apiError('Settled round attribution does not match its verified receipts.', 409);
    }

    return NextResponse.json({
      round,
      season,
      crew,
      members,
      bids,
      winningBid,
      verification,
      verifiedAt: settlementEvent.createdAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Season] Historical replay failed:', { message });
    return apiError(message, 500);
  }
}
