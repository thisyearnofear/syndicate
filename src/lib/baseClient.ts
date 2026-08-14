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

// =============================================================================
// RECEIPT-LOOKUP CLIENT (Base mainnet)
// =============================================================================
// Single-object lookups (eth_getTransactionReceipt / eth_getBlockByHash) go
// through the dedicated Alchemy endpoint when configured, because public RPCs
// have proven unreliable for receipt fetches. Wide getLogs scans must NOT use
// this client: the Alchemy free tier caps eth_getLogs to 10-block ranges, so
// scoring keeps using the public client above.

const BASE_RECEIPT_RPC_URL =
  process.env.BASE_MAINNET_ALCHEMY_RPC_URL || BASE_RPC_URL;

export const baseMainnetReceiptClient = createPublicClient({
  chain: base,
  transport: http(BASE_RECEIPT_RPC_URL, {
    retryCount: 3,
    retryDelay: 1000,
  }),
});

export function getBaseReceiptClientForChain(chainId: number) {
  if (chainId === 84532) return baseSepoliaPublicClient;
  return baseMainnetReceiptClient;
}
