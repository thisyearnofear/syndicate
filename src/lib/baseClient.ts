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
import { base } from 'viem/chains';

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
