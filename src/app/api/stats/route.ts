import { NextResponse } from 'next/server';
import { API } from '@/config';

export async function GET() {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (API.megapot.apiKey) {
      headers['apikey'] = API.megapot.apiKey;
    }

    const response = await fetch(
      `${API.megapot.baseUrl}${API.megapot.endpoints.jackpotStats}`,
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
