/**
 * GET /api/okx/jackpot — free read for agents pricing a purchase.
 *
 * Returns the current Megapot jackpot, ticket price, and draw end time from
 * the same on-chain read path as /api/stats (basePublicClient + MEGAPOT_ABI
 * on the V2 jackpot contract).
 */

import { NextResponse } from 'next/server';
import { formatUnits } from 'viem';
import { basePublicClient } from '@/lib/baseClient';
import { MEGAPOT_ABI, MEGAPOT_V2 } from '@/config/contracts';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const revalidate = 60;

const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=60' };

export async function GET() {
  try {
    const currentId = (await basePublicClient.readContract({
      address: MEGAPOT_V2.jackpot.address,
      abi: MEGAPOT_ABI,
      functionName: 'currentDrawingId',
    } as unknown as Parameters<typeof basePublicClient.readContract>[0])) as bigint;

    const state = (await basePublicClient.readContract({
      address: MEGAPOT_V2.jackpot.address,
      abi: MEGAPOT_ABI,
      functionName: 'getDrawingState',
      args: [currentId],
    } as unknown as Parameters<typeof basePublicClient.readContract>[0])) as {
      prizePool: bigint;
      ticketPrice: bigint;
      globalTicketsBought: bigint;
      drawingTime: bigint;
    };

    return NextResponse.json(
      {
        drawId: Number(currentId),
        jackpotUsd: formatUnits(state.prizePool, 6),
        ticketPriceUsd: formatUnits(state.ticketPrice, 6),
        ticketsSold: Number(state.globalTicketsBought),
        drawTime: Number(state.drawingTime),
        source: 'on-chain',
      },
      { headers: CACHE_HEADERS },
    );
  } catch (err) {
    logger.error('[OkxJackpot] Read failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to read jackpot' },
      { status: 500, headers: CACHE_HEADERS },
    );
  }
}
