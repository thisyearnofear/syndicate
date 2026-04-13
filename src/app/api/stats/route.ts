import { NextResponse } from 'next/server';
import { API } from '@/config';

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

    // Return partial stats if API unavailable
    if (!response) {
      console.warn('[Stats API] All endpoints failed, returning partial data:', lastError?.message);
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

    const totalRaised = stats.ticketsSoldCount && stats.ticketPrice
      ? stats.ticketsSoldCount * stats.ticketPrice
      : null;

    return NextResponse.json({
      totalRaised,
      activePlayers: stats.activePlayers ?? null,
      prizeUsd: stats.prizeUsd ? parseFloat(stats.prizeUsd) : null,
      ticketsSold: stats.ticketsSoldCount ?? null,
      updatedAt: new Date().toISOString(),
      source: 'megapot-api',
    });
  } catch (error) {
    console.error('[Stats API] Unexpected error:', error);
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
