import { NextResponse } from 'next/server';
import { API } from '@/config';
import { basePublicClient } from '@/lib/baseClient';
import { MEGAPOT_ABI, MEGAPOT_V2 } from '@/config/contracts';
import { ethers } from 'ethers';

/**
 * Stats API route - uses same transport logic as /api/megapot
 * Returns partial stats on failure instead of 502
 */

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getCandidateBaseUrls(): string[] {
  const configured = normalizeBaseUrl(API.megapot.baseUrl);
  return [
    'https://api.megapot.io/api/v1',
    'https://api.megapot.io/api/v2',
    configured,
    configured.replace(/\/api\/v2$/i, ''),
  ].filter((value, index, arr) => arr.indexOf(value) === index);
}

export async function GET() {
  try {
    const apiKey = API.megapot.apiKey || process.env.MEGAPOT_API_KEY;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['apikey'] = apiKey;
    }

    let response: Response | null = null;
    let lastError: Error | null = null;

    // Try all candidate URLs with both /jackpot-round-stats/active and /lottery/jackpot-round-stats/active
    for (const baseUrl of getCandidateBaseUrls()) {
      for (const endpoint of ['/jackpot-round-stats/active', '/lottery/jackpot-round-stats/active']) {
        try {
          const url = new URL(`${baseUrl}${endpoint}`);
          if (apiKey) {
            url.searchParams.set('apikey', apiKey);
          }
          
          const attempt = await fetch(url.toString(), {
            headers,
            signal: AbortSignal.timeout(10000),
            cache: 'no-store',
          });
          
          if (attempt.ok) {
            response = attempt;
            break;
          }
        } catch (err) {
          lastError = err as Error;
        }
      }
      if (response) break;
    }

    // Return partial stats if API unavailable or outdated
    if (!response) {
      console.warn('[Stats API] All endpoints failed, trying on-chain fallback');
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
    }

    const stats = await response.json();
    const prizeUsd = stats.prizeUsd ? parseFloat(stats.prizeUsd) : 0;

    // If API returns suspiciously low jackpot (old version), try on-chain
    if (prizeUsd < 100000) {
      console.warn(`[Stats API] API returned suspicious prize ($${prizeUsd}), trying on-chain`);
      const onChainStats = await getOnChainStats();
      if (onChainStats) {
        return NextResponse.json(onChainStats);
      }
    }

    const totalRaised = stats.ticketsSoldCount && stats.ticketPrice
      ? stats.ticketsSoldCount * stats.ticketPrice
      : null;

    return NextResponse.json({
      totalRaised,
      activePlayers: stats.activePlayers ?? null,
      prizeUsd: prizeUsd || null,
      ticketsSold: stats.ticketsSoldCount ?? null,
      updatedAt: new Date().toISOString(),
      source: 'megapot-api',
    });
  } catch (error) {
    console.error('[Stats API] Unexpected error:', error);
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
    } as any) as bigint;

    const state = await basePublicClient.readContract({
      address: MEGAPOT_V2.jackpot.address,
      abi: MEGAPOT_ABI,
      functionName: 'getDrawingState',
      args: [currentId],
    } as any) as any;

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
    console.error('[Stats API] On-chain fallback failed:', error);
    return null;
  }
}
