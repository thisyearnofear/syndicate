/**
 * GET /api/activity/recent
 *
 * Returns recent ticket purchase events from the Megapot contract on Base.
 * Reads the last N TicketPurchased events via getLogs and returns anonymized
 * activity for the social proof feed.
 *
 * Response: { activity: [{ address: "0xAB...CD", tickets: 5, timestamp: 1234, txHash: "0x..." }] }
 *
 * Caches for 30s to avoid excessive RPC calls.
 */

import { NextResponse } from 'next/server';
import { basePublicClient } from '@/lib/baseClient';
import { parseAbiItem } from 'viem';
import { logger } from '@/lib/logger';

const MEGAPOT_V2_ADDRESS = '0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2' as const;

// TicketPurchased(address indexed buyer, uint256 ticketCount, uint256 referralFeePaid)
const TICKET_PURCHASED_EVENT = parseAbiItem(
  'event TicketPurchased(address indexed buyer, uint256 ticketCount, uint256 referralFeePaid)'
);

interface ActivityEntry {
  address: string; // shortened: "0xAB...CD"
  tickets: number;
  timestamp: number;
  txHash: string;
}

// Simple in-memory cache
let cachedActivity: ActivityEntry[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30s

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

async function fetchRecentActivity(): Promise<ActivityEntry[]> {
  try {
    const currentBlock = await basePublicClient.getBlockNumber();
    // ~300 blocks back ≈ 10 minutes on Base (2s blocks)
    const fromBlock = currentBlock - 300n;

    const logs = await basePublicClient.getLogs({
      address: MEGAPOT_V2_ADDRESS,
      event: TICKET_PURCHASED_EVENT,
      fromBlock: fromBlock > 0n ? fromBlock : 0n,
      toBlock: 'latest',
    });

    // Take the most recent 10
    const recent = logs.slice(-10).reverse();

    return recent.map((log) => ({
      address: shortenAddress(log.args.buyer as string),
      tickets: Number(log.args.ticketCount ?? 1),
      timestamp: Date.now(), // Approximate — block timestamp would require extra call
      txHash: log.transactionHash ?? '',
    }));
  } catch (err) {
    logger.warn('[Activity] Failed to fetch recent events', { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export async function GET() {
  try {
    const now = Date.now();

    // Return cached if fresh
    if (cachedActivity && now - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json({ activity: cachedActivity, cached: true });
    }

    const activity = await fetchRecentActivity();
    cachedActivity = activity;
    cacheTimestamp = now;

    return NextResponse.json({ activity, cached: false });
  } catch (err) {
    logger.error('[Activity] Route error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ activity: [], error: 'Failed to fetch activity' });
  }
}
