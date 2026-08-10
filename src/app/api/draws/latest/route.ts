/**
 * GET /api/draws/latest
 *
 * Returns the most recent completed draw result from the Megapot contract.
 * Reads currentDrawingId, then getDrawingState for the previous draw.
 *
 * Response: { draw: { id, prizeUsd, ticketsSold, drawTime, isResolved, winningTicket } | null }
 *
 * Caches for 60s (draws happen once daily).
 */

import { NextResponse } from 'next/server';
import { basePublicClient } from '@/lib/baseClient';
import { MEGAPOT_ABI } from '@/config/contracts';
import { formatUnits } from 'viem';
import { logger } from '@/lib/logger';
import {
  getLatestSettledRound,
  getRoundPlayers,
  getRoundWins,
  megapotAmountToUsd,
} from '@/services/lotteries/megapotDataApi';

const MEGAPOT_V2_ADDRESS = '0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2' as const;

interface DrawResult {
  id: number;
  prizeUsd: string;
  ticketsSold: number;
  drawTime: number; // unix timestamp
  isResolved: boolean;
  winningTicket: number;
  /** Enriched from the Megapot Data API when reachable (may be absent). */
  winner?: string;
  /** Amount actually paid to the top winner (distinct from prize pool). */
  winnerPrizeUsd?: string;
  winnerTicketCount?: number;
  winningNumbers?: { normals: number[]; bonusball: number };
}

// Cache
let cachedDraw: DrawResult | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

async function fetchLatestDraw(): Promise<DrawResult | null> {
  try {
    const currentId = await basePublicClient.readContract({
      address: MEGAPOT_V2_ADDRESS,
      abi: MEGAPOT_ABI,
      functionName: 'currentDrawingId',
    }) as bigint;

    // The current draw is in progress; the last completed is currentId - 1
    const lastDrawId = currentId > 1n ? currentId - 1n : currentId;

    const state = await basePublicClient.readContract({
      address: MEGAPOT_V2_ADDRESS,
      abi: MEGAPOT_ABI,
      functionName: 'getDrawingState',
      args: [lastDrawId],
    }) as {
      prizePool: bigint;
      ticketPrice: bigint;
      globalTicketsBought: bigint;
      drawingTime: bigint;
      winningTicket: bigint;
      jackpotLock: boolean;
    };

    // USDC has 6 decimals
    const prizeUsd = formatUnits(state.prizePool, 6);
    const isResolved = Number(state.winningTicket) > 0 || state.jackpotLock;

    const draw: DrawResult = {
      id: Number(lastDrawId),
      prizeUsd,
      ticketsSold: Number(state.globalTicketsBought),
      drawTime: Number(state.drawingTime),
      isResolved,
      winningTicket: Number(state.winningTicket),
    };

    // Enrich with winner + winning numbers from the Megapot Data API.
    // This is best-effort: the on-chain fields above remain authoritative
    // and the enrichment is simply absent if the API is unreachable.
    if (isResolved) {
      const settled = await getLatestSettledRound();
      if (settled && Number(settled.id) === Number(lastDrawId)) {
        if (settled.winning_numbers) {
          draw.winningNumbers = settled.winning_numbers;
        }
        const wins = await getRoundWins(settled.id, 1);
        const topWin = wins?.data[0];
        if (topWin) {
          draw.winner = topWin.wallet;
          draw.winnerPrizeUsd = megapotAmountToUsd(topWin.amount);
        }
        const players = await getRoundPlayers(settled.id, 1);
        const topPlayer = players?.data[0];
        if (topPlayer) {
          draw.winnerTicketCount = topPlayer.total_ticket_count;
        }
      }
    }

    return draw;
  } catch (err) {
    logger.warn('[Draws] Failed to fetch latest draw', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function GET() {
  try {
    const now = Date.now();
    if (cachedDraw && now - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json({ draw: cachedDraw, cached: true });
    }

    const draw = await fetchLatestDraw();
    cachedDraw = draw;
    cacheTimestamp = now;

    return NextResponse.json({ draw, cached: false });
  } catch (err) {
    logger.error('[Draws] Route error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ draw: null, error: 'Failed to fetch draw' });
  }
}
