import { NextResponse } from 'next/server';
import { basePublicClient } from '@/lib/baseClient';
import { MEGAPOT_ABI, MEGAPOT_V2 } from '@/config/contracts';
import { logger } from '@/lib/logger';

/**
 * Stats API route - reads Megapot jackpot stats directly from the on-chain contract.
 * The api.megapot.io REST API has been restructured and all endpoints return 404.
 */

export async function GET() {
  try {
    const onChainStats = await getOnChainStats();
    if (onChainStats) {
      return NextResponse.json(onChainStats);
    }

    return NextResponse.json({
      totalRaised: null,
      activePlayers: null,
      prizeUsd: null,
      ticketsSold: null,
      updatedAt: new Date().toISOString(),
      source: 'unavailable',
    });
  } catch (error) {
    logger.error('[Stats API] Unexpected error', { error: String(error) });
    const onChainStats = await getOnChainStats().catch(() => null);
    if (onChainStats) return NextResponse.json(onChainStats);

    // Return partial stats instead of 500
    return NextResponse.json({
      totalRaised: null,
      activePlayers: null,
      prizeUsd: null,
      ticketsSold: null,
      updatedAt: new Date().toISOString(),
      source: 'error',
    });
  }
}

async function getOnChainStats() {
  try {
    const currentId = await basePublicClient.readContract({
      address: MEGAPOT_V2.jackpot.address,
      abi: MEGAPOT_ABI,
      functionName: 'currentDrawingId',
    } as unknown as Parameters<typeof basePublicClient.readContract>[0]) as bigint;

    const state = await basePublicClient.readContract({
      address: MEGAPOT_V2.jackpot.address,
      abi: MEGAPOT_ABI,
      functionName: 'getDrawingState',
      args: [currentId],
    } as unknown as Parameters<typeof basePublicClient.readContract>[0]) as Record<string, unknown>;

    const prizeUsd = Number(state.prizePool) / 1e6;
    
    return {
      totalRaised: Number(state.lpEarnings || 0) / 1e6,
      activePlayers: null,
      prizeUsd,
      ticketsSold: Number(state.globalTicketsBought || 0),
      updatedAt: new Date().toISOString(),
      source: 'on-chain',
    };
  } catch (error) {
    logger.error('[Stats API] On-chain fallback failed', { error: String(error) });
    return null;
  }
}
