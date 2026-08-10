/**
 * MEGAPOT DATA API CLIENT
 *
 * Read-only REST client for the official Megapot Data API
 * (https://docs.megapot.io/build-on-megapot/pull-data).
 *
 * Use this for cross-drawing aggregates and history (rounds, wallet tickets,
 * wallet stats, wins) instead of the legacy, restructured REST endpoints that
 * 404 (see megapotService history) or slow RPC pagination loops. Live
 * current-drawing state and all writes stay on the RPC path
 * (OnChainFallbackService / TransactionExecutor).
 *
 * Key facts from the docs:
 * - Base URL https://api.megapot.io/v1 (testnet: https://api-testnet.megapot.io/v1)
 * - Anonymous tier allowed; elevated tier via `mpk_live_*` / `mpk_testnet_*`
 *   Bearer keys (self-serve from the Megapot dashboard). Key is optional here
 *   via MEGAPOT_API_KEY (server) or NEXT_PUBLIC_MEGAPOT_API_KEY (client).
 * - Every amount is { amount: string, decimals: number } (USDC smallest unit).
 * - Round.id is the on-chain drawingId, stringified.
 * - Cursor pagination: { data, next_cursor, has_more }.
 * - Error envelope: { error: { code, message, request_id } }.
 *
 * Resilience: every helper returns null (not throw) on network/API errors so
 * callers keep their existing fallbacks (on-chain reads, empty states). The
 * API may be unreachable in some geographies — degradation must never break UI.
 */

import { logger } from '@/lib/logger';

// =============================================================================
// TYPES (mirrors api.megapot.io/v1/openapi.json)
// =============================================================================

export interface MegapotAmount {
  amount: string;
  decimals: number;
}

export type MegapotRoundStatus = 'active' | 'settled';

export interface MegapotRound {
  id: string; // stringified on-chain drawingId
  status: MegapotRoundStatus;
  prize_pool: MegapotAmount;
  ticket_count: number;
  unique_participants: number;
  winners_count: number;
  top_prize_amount: MegapotAmount | null;
  top_prize_winners_count: number;
  lp_earnings: MegapotAmount;
  started_at: string | null;
  ended_at: string | null;
  settled_at: string | null;
  ball_pool: { normals_max: number; bonusball_max: number };
  winning_numbers: { normals: number[]; bonusball: number } | null;
  prize_tiers: Array<{
    tier_id: number;
    normal_matches: number;
    bonusball_match: boolean;
    payout: MegapotAmount;
    ticket_count: number;
  }> | null;
}

export interface MegapotTicket {
  id: string;
  wallet: string; // recipient / owner
  buyer: string;
  round_id: string;
  user_ticket_id: string; // stringified uint256, for claimWinnings
  normals: number[];
  bonusball: number;
  matched_normals: number[] | null;
  bonusball_match: boolean | null;
  winnings_amount: MegapotAmount | null;
  claimed: boolean;
  claimed_tx_hash: string | null;
  tx_hash: string;
  block_number: number;
  created_at: string;
}

export interface MegapotWin extends Omit<MegapotTicket, 'winnings_amount' | 'matched_normals' | 'bonusball_match'> {
  amount: MegapotAmount;
  matched_normals: number[];
  bonusball_match: boolean;
}

export interface MegapotPlayer {
  wallet: string;
  total_ticket_count: number;
  winning_ticket_count: number;
  total_payout: MegapotAmount;
}

export interface MegapotPage<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
}

// =============================================================================
// CLIENT
// =============================================================================

const MAINNET_BASE_URL = 'https://api.megapot.io/v1';
// Testnet deployments use https://api-testnet.megapot.io/v1 via MEGAPOT_DATA_API_URL.
const REQUEST_TIMEOUT_MS = 8_000;

function getBaseUrl(): string {
  // Production Base mainnet by default; set MEGAPOT_DATA_API_URL to
  // https://api-testnet.megapot.io/v1 for Base Sepolia environments.
  return process.env.MEGAPOT_DATA_API_URL || MAINNET_BASE_URL;
}

/** Optional API key: server env first, then browser-visible env. */
function getApiKey(): string | undefined {
  return process.env.MEGAPOT_API_KEY || process.env.NEXT_PUBLIC_MEGAPOT_API_KEY || undefined;
}

// Short-TTL in-memory cache keyed by request path (per process/module instance).
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export function clearMegapotApiCache(): void {
  cache.clear();
}

async function apiGet<T>(path: string, ttlMs: number): Promise<T | null> {
  const cacheKey = path;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const apiKey = getApiKey();
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const base = getBaseUrl();
    const res = await fetch(`${base}${path}`, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      let code = 'unknown';
      try {
        const body = (await res.json()) as { error?: { code?: string } };
        code = body.error?.code ?? code;
      } catch {
        // non-JSON error body — ignore
      }
      logger.warn(`[MegapotDataApi] ${path} returned ${res.status} (${code})`);
      return null;
    }

    const data = (await res.json()) as T;
    cache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
    return data;
  } catch (error) {
    logger.warn(`[MegapotDataApi] ${path} failed`, { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/** Format an API Amount as a human USDC string (e.g. "1104105.694137"). */
export function megapotAmountToUsd(amount: MegapotAmount | null | undefined): string {
  if (!amount) return '0';
  const raw = BigInt(amount.amount);
  const divisor = 10n ** BigInt(amount.decimals);
  const whole = raw / divisor;
  const frac = (raw % divisor).toString().padStart(amount.decimals, '0').replace(/0+$/, '');
  return frac.length > 0 ? `${whole}.${frac}` : `${whole}`;
}

// =============================================================================
// READS
// =============================================================================

const TTL_ACTIVE_ROUND_MS = 20_000;
const TTL_SETTLED_MS = 300_000;
const TTL_WALLET_MS = 60_000;

/** Current open/drawing round, including expected prize tiers. */
export function getActiveRound(): Promise<MegapotRound | null> {
  return apiGet<MegapotRound>('/rounds/active', TTL_ACTIVE_ROUND_MS);
}

/** Most recently settled round (last completed drawing). */
export function getLatestSettledRound(): Promise<MegapotRound | null> {
  return apiGet<MegapotRound>('/rounds/latest-settled', TTL_SETTLED_MS);
}

/** Top wins in a round, sorted by amount descending. */
export function getRoundWins(roundId: string, limit = 10): Promise<MegapotPage<MegapotWin> | null> {
  return apiGet<MegapotPage<MegapotWin>>(`/rounds/${roundId}/wins?limit=${limit}`, TTL_SETTLED_MS);
}

/** Per-player aggregates for a round, sorted by payout. First row = biggest winner. */
export function getRoundPlayers(roundId: string, limit = 10): Promise<MegapotPage<MegapotPlayer> | null> {
  return apiGet<MegapotPage<MegapotPlayer>>(`/rounds/${roundId}/players?limit=${limit}`, TTL_SETTLED_MS);
}

/** Paginated tickets for a wallet across all rounds. */
export function getWalletTickets(walletAddress: string, limit = 50): Promise<MegapotPage<MegapotTicket> | null> {
  return apiGet<MegapotPage<MegapotTicket>>(
    `/wallets/${walletAddress}/tickets?limit=${limit}`,
    TTL_WALLET_MS
  );
}
