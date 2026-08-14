/**
 * POST /api/season/rounds/[id]/settle — journal a call-the-pot settlement.
 *
 * This endpoint moves NO money. The two real purchases (caller payout and
 * crew bonus) are executed by the winner/coordinator through the existing
 * purchase rails; this route verifies BOTH receipts on the season's chain
 * and only then records the state transition:
 *
 *   round → settled (winning bid, payout + bonus tx hashes)
 *   bids  → won / lost
 *   seat  → freed_exit + cuts renormalized
 *
 * Rejected receipts are journaled as `settle.rejected` with the reason —
 * explicit failure, never a fabricated success (docs/SEASON.md §2.3).
 */

import { NextRequest, NextResponse } from 'next/server';
import { settleCallRoundByReceipts } from '@/services/season/settlementService';
import { apiError, apiValidationError, checkRateLimit, rateLimitError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`season-settle:${ip}`, { windowMs: 60_000, maxRequests: 10 });
  if (!rl.allowed) return rateLimitError(rl.resetAt);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return apiValidationError('Invalid JSON body');

    const { callerPayoutTxHash, crewBonusTxHash, settleTxHash } = body as {
      callerPayoutTxHash?: string;
      crewBonusTxHash?: string;
      settleTxHash?: string;
    };

    const result = await settleCallRoundByReceipts({
      roundId: id,
      callerPayoutTxHash: callerPayoutTxHash ?? '',
      crewBonusTxHash: crewBonusTxHash ?? '',
      settleTxHash,
    });

    if (!result.ok) {
      logger.warn('[SeasonSettle] Settlement rejected', { roundId: id, error: result.error });
      return apiValidationError(result.error ?? 'Settlement failed');
    }

    return NextResponse.json({
      ok: true,
      roundId: result.roundId,
      winningBidId: result.winningBidId,
      verification: result.verification,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[SeasonSettle] Settlement error:', { message });
    return apiError(message, 500);
  }
}
