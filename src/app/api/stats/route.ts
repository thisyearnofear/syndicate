import { NextResponse } from 'next/server';
import { API } from '@/config';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getCandidateBaseUrls(): string[] {
  const configured = normalizeBaseUrl(API.megapot.baseUrl);
  return [
    configured,
    configured.replace(/\/api\/v2$/i, ''),
    'https://api.megapot.io/api/v2',
  ].filter((value, index, arr) => arr.indexOf(value) === index);
}

function getEndpointVariants(endpoint: string): string[] {
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const lotteryPrefixed = normalized.startsWith('/lottery/') ? normalized : `/lottery${normalized}`;
  return [normalized, lotteryPrefixed].filter((value, index, arr) => arr.indexOf(value) === index);
}

export async function GET() {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (API.megapot.apiKey) {
      headers['apikey'] = API.megapot.apiKey;
    }

    let response: Response | null = null;
    for (const baseUrl of getCandidateBaseUrls()) {
      for (const endpoint of getEndpointVariants(API.megapot.endpoints.jackpotStats)) {
        const attempt = await fetch(
          `${baseUrl}${endpoint}`,
          { headers, signal: AbortSignal.timeout(15000) }
        );
        if (attempt.ok) {
          response = attempt;
          break;
        }
      }
      if (response) break;
    }

    if (!response) {
      return NextResponse.json(
        { error: 'Failed to fetch jackpot stats' },
        { status: 502 }
      );
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
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
