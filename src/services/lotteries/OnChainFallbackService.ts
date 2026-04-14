/**
 * ON-CHAIN FALLBACK SERVICE
 * 
 * Fallback for reading prize data directly from contracts when APIs are unavailable.
 * Uses viem public client to read contract state.
 */

import { createPublicClient, http, Address } from 'viem';
import { base } from 'viem/chains';

// =============================================================================
// CHAIN CONFIGURATION
// =============================================================================

const basePublicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/demo'),
});

// =============================================================================
// CONTRACT ADDRESSES
// =============================================================================

const POOLTOGETHER_VAULT_ADDRESS: Address = '0x6B5a5c55E9dD4bb502Ce25bBfbaA49b69cf7E4dd';

// =============================================================================
// INTERFACES
// =============================================================================

export interface OnChainPrizeData {
  prizeUsd: string;
  totalDepositsUsd: string;
  ticketCount: string;
  drawId: string;
  nextDrawTimestamp: number;
  chainId: number;
}

// =============================================================================
// POOLTOGETHER ON-CHAIN READ
// =============================================================================

const ERC4626_ABI = [
  {
    name: 'totalSupply',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'totalAssets',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Read PoolTogether prize data directly from the blockchain
 */
export async function getPoolTogetherOnChainPrize(): Promise<OnChainPrizeData | null> {
  try {
    const results = await Promise.allSettled([
      basePublicClient.readContract({
        address: POOLTOGETHER_VAULT_ADDRESS,
        abi: ERC4626_ABI,
        functionName: 'totalSupply',
      } as any),
      basePublicClient.readContract({
        address: POOLTOGETHER_VAULT_ADDRESS,
        abi: ERC4626_ABI,
        functionName: 'totalAssets',
      } as any),
    ]);

    const zero = BigInt(0);
    const totalSupply = results[0].status === 'fulfilled' ? results[0].value as bigint : zero;
    const totalAssets = results[1].status === 'fulfilled' ? results[1].value as bigint : zero;

    const depositsUsd = Number(totalAssets || totalSupply) / 1e6;

    if (depositsUsd <= 0) {
      console.warn('[OnChainFallback] No PoolTogether data available from chain');
      return null;
    }

    // Sanity check: if value exceeds $100M, the data is clearly wrong
    if (depositsUsd > 100_000_000) {
      console.warn('[OnChainFallback] PoolTogether data looks invalid (too large):', depositsUsd);
      return null;
    }

    const estimatedPrize = depositsUsd * 0.001;

    return {
      prizeUsd: estimatedPrize.toFixed(2),
      totalDepositsUsd: depositsUsd.toFixed(2),
      ticketCount: '0',
      drawId: '0',
      nextDrawTimestamp: 0,
      chainId: 8453,
    };
  } catch (error) {
    console.warn('[OnChainFallback] Failed to read PoolTogether from chain:', error);
    return null;
  }
}
