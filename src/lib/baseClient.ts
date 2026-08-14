/**
 * SHARED BASE PUBLIC CLIENT
 *
 * Single source of truth for all Base chain RPC interactions.
 * Consolidates ~10 duplicate createPublicClient instances into one.
 *
 * Core Principles Applied:
 * - DRY: One client, reused everywhere
 * - PERFORMANT: Multicall batching, longer polling interval, retry logic
 * - CLEAN: Explicit configuration in one place
 */

import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';

const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ||
  process.env.BASE_RPC_URL ||
  'https://mainnet.base.org';

export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL, {
    batch: true,
    retryCount: 3,
    retryDelay: 1000,
  }),
  batch: {
    multicall: true,
  },
});

// =============================================================================
// CHAIN-AWARE CLIENTS (Season of Tickets: Base Sepolia testnet + Base mainnet)
// =============================================================================

const BASE_SEPOLIA_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
  process.env.BASE_SEPOLIA_RPC_URL ||
  'https://sepolia.base.org';

export const baseSepoliaPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(BASE_SEPOLIA_RPC_URL, {
    batch: true,
    retryCount: 3,
    retryDelay: 1000,
  }),
  batch: {
    multicall: true,
  },
});

/**
 * Pick the right public client for a chain id. Season receipts are verified
 * against the season's own chain (docs/SEASON.md: testnet and mainnet
 * ladders never mix).
 *
 * The return type is left to inference (a union of the two concrete clients).
 * Annotating it as viem's generic `PublicClient` trips TS2719 when `viem`
 * and `viem/chains` resolve to different copies in the module graph.
 */
export function getBaseClientForChain(chainId: number) {
  // 84532 = Base Sepolia
  if (chainId === 84532) return baseSepoliaPublicClient;
  return basePublicClient;
}
