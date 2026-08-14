/**
 * POST /api/season/crews — found a new crew for the active season.
 * GET  /api/season/crews?seasonId=… — list a season's crews (ladder).
 * GET  /api/season/crews?code=CREW-… — resolve a single crew by referral code.
 *
 * No money moves here: a crew is a named seat registry plus a referral code
 * members use when buying their real Megapot tickets. Writes are
 * rate-limited and journaled to season_events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  appendSeasonEvent,
  createCrew,
  ensureSeasonTables,
  getCrewByReferrerCode,
  getSeasonById,
  listSeasonCrews,
  type SeasonCrewKind,
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

function generateReferrerCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `CREW-${code}`;
}

export async function GET(req: NextRequest) {
  try {
    await ensureSeasonTables();

    const code = req.nextUrl.searchParams.get('code');
    if (code) {
      const crew = await getCrewByReferrerCode(code.trim().toUpperCase());
      if (!crew) return apiNotFound('Crew not found for that referral code');
      return NextResponse.json({ crew });
    }

    const seasonId = req.nextUrl.searchParams.get('seasonId');
    if (!seasonId) return apiValidationError('seasonId or code is required');
    const crews = await listSeasonCrews(seasonId);
    return NextResponse.json({ crews });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Season] Crew list failed:', { message });
    return apiError(message, 500);
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`season-crew-create:${ip}`, { windowMs: 60_000, maxRequests: 10 });
  if (!rl.allowed) return rateLimitError(rl.resetAt);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return apiValidationError('Invalid JSON body');

    const { seasonId, name, kind, coordinatorAddress, syndicatePoolId, crestAccent } = body as {
      seasonId?: string;
      name?: string;
      kind?: SeasonCrewKind;
      coordinatorAddress?: string;
      syndicatePoolId?: string;
      crestAccent?: string;
    };

    if (!seasonId || typeof seasonId !== 'string') return apiValidationError('seasonId is required');
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 40) {
      return apiValidationError('Crew name must be 2–40 characters');
    }
    if (kind !== 'quick' && kind !== 'syndicate') {
      return apiValidationError("kind must be 'quick' or 'syndicate'");
    }
    if (!coordinatorAddress || !EVM_ADDRESS.test(coordinatorAddress)) {
      return apiValidationError('coordinatorAddress must be a valid EVM address');
    }

    await ensureSeasonTables();
    const season = await getSeasonById(seasonId);
    if (!season) return apiValidationError('Season not found');
    if (season.status !== 'active') return apiValidationError('Season is not active');

    const crew = await createCrew({
      id: randomUUID(),
      seasonId: season.id,
      name: name.trim(),
      crestAccent,
      kind,
      syndicatePoolId: syndicatePoolId ?? null,
      coordinatorAddress,
      referrerCode: generateReferrerCode(),
    });

    await appendSeasonEvent({
      id: randomUUID(),
      seasonId: season.id,
      crewId: crew.id,
      kind: 'crew.created',
      payload: { name: crew.name, coordinator: coordinatorAddress, crewKind: kind },
    });

    logger.info('[Season] Crew created', { crewId: crew.id, kind });
    return NextResponse.json(crew, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Season] Crew create failed:', { message });
    return apiError(message, 500);
  }
}
