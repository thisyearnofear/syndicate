import { NextResponse } from 'next/server';

const MEGAPOT_API_BASE_URL = 'https://api.megapot.io/api/v1';
const MEGAPOT_API_KEY = process.env.NEXT_PUBLIC_MEGAPOT_API_KEY;

export async function GET() {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (MEGAPOT_API_KEY) {
      headers['apikey'] = MEGAPOT_API_KEY;
    }

    const response = await fetch(
      `${MEGAPOT_API_BASE_URL}/jackpot-round-stats/active`,
      { headers, signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
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
