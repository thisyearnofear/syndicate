/**
 * POST /api/season/crews/[id]/join — take a seat in a crew.
 *
 * Joining moves no money: it registers the address as an active seat and
 * renormalizes every seat's tontine cut. The member's real Megapot entries
 * are counted via the crew's referral code at purchase time (existing
 * referralManager rail), not here. Rate-limited + journaled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  appendSeasonEvent,
  ensureSeasonTables,
  getCrewById,
  upsertCrewMember,
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
  const rl = checkRateLimit(`season-join:${ip}`, { windowMs: 60_000, maxRequests: 20 });
  if (!rl.allowed) return rateLimitError(rl.resetAt);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return apiValidationError('Invalid JSON body');

    const { address, txHash } = body as { address?: string; txHash?: string };
    if (!address || !EVM_ADDRESS.test(address)) {
      return apiValidationError('address must be a valid EVM address');
    }

    await ensureSeasonTables();
    const crew = await getCrewById(id);
    if (!crew) return apiNotFound('Crew not found');
    if (crew.status !== 'active') return apiValidationError('Crew is archived');

    const member = await upsertCrewMember({
      id: randomUUID(),
      crewId: id,
      memberAddress: address.toLowerCase(),
      joinTxHash: txHash ?? null,
    });

    await appendSeasonEvent({
      id: randomUUID(),
      seasonId: crew.seasonId,
      crewId: id,
      kind: 'seat.taken',
      payload: { address: member.memberAddress },
    });

    logger.info('[Season] Seat taken', { crewId: id, address: member.memberAddress });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Season] Join failed:', { message });
    return apiError(message, 500);
  }
}
