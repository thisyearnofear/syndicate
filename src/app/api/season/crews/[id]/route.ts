/**
 * GET /api/season/crews/[id] — one crew's full state for the Season view:
 * crew row, member seats with cuts, the open call-the-pot round (if any)
 * with its live bids, and the crew's recent event feed.
 *
 * Read-only; no wallet required.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureSeasonTables,
  getCrewById,
  listCrewMembers,
  listCrewEvents,
  getOpenCallRound,
  listRoundBids,
} from '@/lib/db/repositories/seasonRepository';
import { apiError, apiNotFound } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await ensureSeasonTables();

    const crew = await getCrewById(id);
    if (!crew) return apiNotFound('Crew not found');

    const [members, events, round] = await Promise.all([
      listCrewMembers(id),
      listCrewEvents(id, 30),
      getOpenCallRound(id),
    ]);

    const bids = round ? await listRoundBids(round.id) : [];

    return NextResponse.json({ crew, members, events, openRound: round, bids });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Season] Crew detail failed:', { message });
    return apiError(message, 500);
  }
}
