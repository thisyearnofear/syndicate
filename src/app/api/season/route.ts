/**
 * GET /api/season — Season HQ payload.
 *
 * Returns the active season for the given chain (default Base mainnet), its
 * crew ladder, and the recent public event feed. Testnet and mainnet seasons
 * are separate rows (chain_id scoped) and never mixed in one ladder.
 *
 * Read-only; no wallet required.
 *
 * POST /api/season — create a season (operator/demo setup).
 * Requires `Authorization: Bearer <SEASON_ADMIN_KEY>`. Fails closed (503)
 * when SEASON_ADMIN_KEY is not configured.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureSeasonTables,
  getActiveSeason,
  createSeason,
  appendSeasonEvent,
  listSeasonCrews,
  listSeasonEvents,
  listSeasonSettledRoundIds,
} from '@/lib/db/repositories/seasonRepository';
import { scoreSeasonCrews } from '@/services/season/scoringService';
import { randomUUID } from 'node:crypto';
import { CHAIN_IDS } from '@/config/contracts';
import { apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const chainParam = req.nextUrl.searchParams.get('chainId');
    const chainId = chainParam ? Number(chainParam) : CHAIN_IDS.BASE;
    if (!Number.isFinite(chainId)) {
      return apiError('Invalid chainId', 400);
    }

    await ensureSeasonTables();
    const season = await getActiveSeason(chainId);
    if (!season) {
      return NextResponse.json({ season: null, crews: [], events: [], settledRoundIds: [] });
    }

    const [crews, events, settledRoundIds] = await Promise.all([
      listSeasonCrews(season.id),
      listSeasonEvents(season.id, 30),
      listSeasonSettledRoundIds(season.id, 3),
    ]);

    // Scoring is best-effort: if the chain scan fails, the ladder falls
    // back to member counts. Nothing is ever fabricated.
    let scores: Record<string, { purchases: number; entries: number }> = {};
    let scoring: { ok: boolean; error?: string } = { ok: false, error: 'Scoring unavailable' };
    if (crews.length > 0) {
      try {
        const scored = await scoreSeasonCrews(season);
        scores = scored.scores;
        scoring = scored.summary.error
          ? { ok: scored.summary.ok, error: scored.summary.error }
          : { ok: scored.summary.ok };
      } catch (error) {
        logger.warn('[Season] Scoring skipped', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const scoredCrews = crews.map((crew) => ({ ...crew, score: scores[crew.id] ?? null }));

    return NextResponse.json({ season, crews: scoredCrews, events, settledRoundIds, scoring });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Season] Read failed:', { message });
    return apiError(message, 500);
  }
}

export async function POST(req: NextRequest) {
  const adminKey = process.env.SEASON_ADMIN_KEY;
  if (!adminKey) {
    return apiError('Season creation is not enabled in this environment.', 503);
  }
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${adminKey}`) {
    return apiError('Unauthorized', 401);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return apiError('Invalid JSON body', 400);
    }

    const { name, chainId, drawWindowStart, drawWindowEnd, minChestUsdc, inactivityDraws, status } = body as {
      name?: string;
      chainId?: number;
      drawWindowStart?: number;
      drawWindowEnd?: number;
      minChestUsdc?: string;
      inactivityDraws?: number;
      status?: 'scheduled' | 'active' | 'closed';
    };

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return apiError('name is required (min 2 chars)', 400);
    }
    const chain = chainId ?? CHAIN_IDS.BASE;
    if (!Number.isFinite(chain)) {
      return apiError('Invalid chainId', 400);
    }
    if (typeof drawWindowStart !== 'number' || typeof drawWindowEnd !== 'number') {
      return apiError('drawWindowStart and drawWindowEnd (epoch ms) are required', 400);
    }
    if (drawWindowEnd <= drawWindowStart) {
      return apiError('drawWindowEnd must be after drawWindowStart', 400);
    }

    await ensureSeasonTables();
    const season = await createSeason({
      id: randomUUID(),
      name: name.trim(),
      chainId: chain,
      drawWindowStart,
      drawWindowEnd,
      status: status ?? 'active',
      minChestUsdc,
      inactivityDraws,
    });

    await appendSeasonEvent({
      id: randomUUID(),
      seasonId: season.id,
      kind: 'season.created',
      payload: { name: season.name, chainId: season.chainId },
    });

    logger.info('[Season] Season created', { seasonId: season.id, name: season.name, chainId: season.chainId });
    return NextResponse.json(season, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Season] Season create failed:', { message });
    return apiError(message, 500);
  }
}
