/**
 * POST /api/season/crews/[id]/rounds — "Call the Pot": open a call round.
 *
 * Any active seat may call the pot. Calling opens an ascending auction
 * (highest offer to the crew wins) over the crew's accumulated yield chest
 * and places the caller's initial bid. No money moves at call time — settlement later performs the
 * real on-chain purchases (see /api/season/rounds/[id]/settle).
 *
 * Body:
 *   callerAddress  (required) — EVM address of the calling member
 *   discountBps    (required) — caller's opening bid (100..5000)
 *   chestUsdc      (optional) — chest snapshot override (string/number, > 0).
 *                    For v1 the chest is caller-supplied or defaults to the
 *                    season minimum; a production build would read the live
 *                    yield balance of the linked syndicate pool.
 *   cutoffAt       (optional) — absolute cutoff (epoch ms). Mutually exclusive
 *                    with cutoffSeconds.
 *   cutoffSeconds  (optional) — seconds from now until cutoff (default 300).
 *
 * Writes are rate-limited and journaled to season_events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  appendSeasonEvent,
  createCallRound,
  ensureSeasonTables,
  getCrewById,
  getOpenCallRound,
  getSeasonById,
  listCrewMembers,
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`season-round-open:${ip}`, { windowMs: 60_000, maxRequests: 10 });
  if (!rl.allowed) return rateLimitError(rl.resetAt);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return apiValidationError('Invalid JSON body');

    const { callerAddress, discountBps, chestUsdc, cutoffAt, cutoffSeconds } = body as {
      callerAddress?: string;
      discountBps?: number;
      chestUsdc?: string | number;
      cutoffAt?: number;
      cutoffSeconds?: number;
    };

    if (!callerAddress || !EVM_ADDRESS.test(callerAddress)) {
      return apiValidationError('callerAddress must be a valid EVM address');
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
    const crew = await getCrewById(id);
    if (!crew) return apiNotFound('Crew not found');
    if (crew.status !== 'active') return apiValidationError('Crew is archived');

    const season = await getSeasonById(crew.seasonId);
    if (!season) return apiNotFound('Season not found');
    if (season.status !== 'active') return apiValidationError('Season is not active');

    // Only active seats may call the pot.
    const members = await listCrewMembers(id);
    const caller = members.find(
      (m) => m.memberAddress === callerAddress.toLowerCase() && m.seatStatus === 'active',
    );
    if (!caller) return apiValidationError('Caller does not hold an active seat in this crew');

    // Only one open round per crew at a time.
    const existing = await getOpenCallRound(id);
    if (existing) return apiValidationError('A call round is already open for this crew');

    // Resolve the chest snapshot.
    let chest: string;
    if (chestUsdc !== undefined && chestUsdc !== null) {
      const parsed = Number(chestUsdc);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return apiValidationError('chestUsdc must be a positive number');
      }
      chest = parsed.toFixed(6);
    } else {
      chest = season.minChestUsdc;
    }
    if (Number(chest) < Number(season.minChestUsdc)) {
      return apiValidationError(`Chest below season minimum of ${season.minChestUsdc} USDC`);
    }

    // Resolve the cutoff.
    let cutoffMs: number;
    if (cutoffAt !== undefined && cutoffAt !== null) {
      cutoffMs = Number(cutoffAt);
      if (!Number.isFinite(cutoffMs) || cutoffMs <= Date.now()) {
        return apiValidationError('cutoffAt must be a future epoch-ms timestamp');
      }
    } else {
      const secs = typeof cutoffSeconds === 'number' && cutoffSeconds > 0 ? cutoffSeconds : 300;
      cutoffMs = Date.now() + secs * 1000;
    }

    const round = await createCallRound({
      id: randomUUID(),
      crewId: id,
      chestSnapshotUsdc: chest,
      cutoffAt: new Date(cutoffMs).toISOString(),
    });

    // The caller places the opening bid.
    const { bid } = await placeOrReviseBid({
      id: randomUUID(),
      roundId: round.id,
      bidderAddress: callerAddress.toLowerCase(),
      discountBps,
    });

    await appendSeasonEvent({
      id: randomUUID(),
      seasonId: crew.seasonId,
      crewId: id,
      kind: 'round.opened',
      payload: { roundId: round.id, chestUsdc: chest, caller: callerAddress.toLowerCase() },
    });
    await appendSeasonEvent({
      id: randomUUID(),
      seasonId: crew.seasonId,
      crewId: id,
      kind: 'bid.placed',
      payload: { roundId: round.id, bidder: bid.bidderAddress, discountBps: bid.discountBps },
    });

    logger.info('[Season] Call round opened', {
      roundId: round.id,
      crewId: id,
      chestUsdc: chest,
      caller: callerAddress.toLowerCase(),
      discountBps,
    });

    return NextResponse.json({ round, bid }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Season] Call round open failed:', { message });
    return apiError(message, 500);
  }
}
