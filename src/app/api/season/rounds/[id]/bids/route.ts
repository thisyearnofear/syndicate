/**
 * GET/POST /api/season/rounds/[id]/bids — the call-the-pot auction.
 *
 * GET lists the live bids (lowest discount first — that is the current
 * leader). POST places or revises the caller's bid; the server enforces the
 * bid bounds (1%–50%), that the bidder holds an active seat in the crew, and
 * the anti-snipe rule (a bid in the final 5 minutes extends the cutoff by 5).
 * Bids commit nothing on-chain — settlement happens separately with
 * receipt-verified purchases.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  appendSeasonEvent,
  ensureSeasonTables,
  getCallRoundById,
  listRoundBids,
  placeOrReviseBid,
} from '@/lib/db/repositories/seasonRepository';
import {
  apiError,
  apiNotFound,
  apiValidationError,
  checkRateLimit,
  rateLimitError,
} from '@/lib/api/response';
import { logger } from '@/lib/logger';

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await ensureSeasonTables();
    const round = await getCallRoundById(id);
    if (!round) return apiNotFound('Round not found');
    const bids = await listRoundBids(id);
    return NextResponse.json({ round, bids });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Season] Bids read failed:', { message });
    return apiError(message, 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`season-bid:${ip}`, { windowMs: 60_000, maxRequests: 30 });
  if (!rl.allowed) return rateLimitError(rl.resetAt);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return apiValidationError('Invalid JSON body');

    const { bidderAddress, discountBps } = body as {
      bidderAddress?: string;
      discountBps?: number;
    };
    if (!bidderAddress || !EVM_ADDRESS.test(bidderAddress)) {
      return apiValidationError('bidderAddress must be a valid EVM address');
    }
    if (
      typeof discountBps !== 'number' ||
      !Number.isInteger(discountBps) ||
      discountBps < 100 ||
      discountBps > 5000
    ) {
      return apiValidationError('discountBps must be an integer between 100 and 5000');
    }

    await ensureSeasonTables();
    const round = await getCallRoundById(id);
    if (!round) return apiNotFound('Round not found');

    const { bid, round: updatedRound } = await placeOrReviseBid({
      id: randomUUID(),
      roundId: id,
      bidderAddress: bidderAddress.toLowerCase(),
      discountBps,
    });

    await appendSeasonEvent({
      id: randomUUID(),
      crewId: round.crewId,
      kind: 'bid.placed',
      payload: { roundId: id, bidder: bid.bidderAddress, discountBps: bid.discountBps },
    });

    logger.info('[Season] Bid placed', { roundId: id, bidder: bid.bidderAddress, discountBps });
    return NextResponse.json({ bid, round: updatedRound }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not open') || message.includes('has closed')) {
      return apiError(message, 409);
    }
    logger.error('[Season] Bid failed:', { message });
    return apiError(message, 500);
  }
}
