/**
 * ON-CHAIN FALLBACK SERVICE
 * 
 * Fallback for reading prize data directly from contracts when APIs are unavailable.
 * Uses viem public client to read contract state.
 */

import { Address } from 'viem';
import { basePublicClient } from '@/lib/baseClient';
import { MEGAPOT_ABI } from '@/config/contracts';

// =============================================================================
// CONTRACT ADDRESSES
// =============================================================================

const POOLTOGETHER_VAULT_ADDRESS: Address = '0x7f5C2b379b88499aC2B997Db583f8079503f25b9';
const POOLTOGETHER_PRIZE_POOL_ADDRESS: Address = '0x45b2010d8A4F08B53c9fa7544C51dFD9733732cb';
const MEGAPOT_V2_ADDRESS: Address = '0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2';

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

const PRIZE_POOL_ABI = [
  {
    name: 'getTierPrizeSize',
    type: 'function',
    inputs: [{ name: 'tier', type: 'uint8' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'numberOfTiers',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
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
      basePublicClient.readContract({
        address: POOLTOGETHER_PRIZE_POOL_ADDRESS,
        abi: PRIZE_POOL_ABI,
        functionName: 'getTierPrizeSize',
        args: [0], // Tier 0 is the Grand Prize
      } as any),
    ]);

    const zero = BigInt(0);
    const totalSupply = results[0].status === 'fulfilled' ? results[0].value as bigint : zero;
    const totalAssets = results[1].status === 'fulfilled' ? results[1].value as bigint : zero;
    const grandPrizeSize = results[2].status === 'fulfilled' ? results[2].value as bigint : zero;

    const depositsUsd = Number(totalAssets || totalSupply) / 1e6; // USDC vault: 6 decimals

    // Prize Pool returns prize sizes in 18 decimals (WETH-denominated)
    // Detect: if value > 1e12, it's 18-decimal; otherwise assume 6-decimal
    const rawPrize = Number(grandPrizeSize);
    const prizeUsd = rawPrize > 1e12 ? rawPrize / 1e18 : rawPrize / 1e6;

    if (depositsUsd <= 0) {
      console.warn('[OnChainFallback] No PoolTogether data available from chain');
      return null;
    }

    // Sanity check: if value exceeds $100M, the data is clearly wrong
    if (depositsUsd > 100_000_000) {
      console.warn('[OnChainFallback] PoolTogether data looks invalid (too large):', depositsUsd);
      return null;
    }

    const estimatedPrize = prizeUsd > 0 ? prizeUsd : (depositsUsd * 0.001);

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

// =============================================================================
// MEGAPOT ON-CHAIN READ
// =============================================================================

/**
 * Read Megapot prize data directly from the blockchain
 */
export async function getMegapotOnChainPrize(): Promise<OnChainPrizeData | null> {
  try {
    const currentId = await basePublicClient.readContract({
      address: MEGAPOT_V2_ADDRESS,
      abi: MEGAPOT_ABI,
      functionName: 'currentDrawingId',
    } as any) as bigint;

    const state = await basePublicClient.readContract({
      address: MEGAPOT_V2_ADDRESS,
      abi: MEGAPOT_ABI,
      functionName: 'getDrawingState',
      args: [currentId],
    } as any) as any;

    const prizeUsd = Number(state.prizePool) / 1e6;
    const totalPoolUsd = Number(state.prizePool || 0) / 1e6; // Using prizePool as proxy for grand prize, need logic for total. Actually state.lpEarnings + prizePool is better
    const totalLiquidityUsd = Number((state.lpEarnings || 0n) + (state.prizePool || 0n)) / 1e6;

    if (prizeUsd <= 0) {
      console.warn('[OnChainFallback] No Megapot prize data available from chain');
      return null;
    }

    return {
      prizeUsd: prizeUsd.toFixed(2),
      totalDepositsUsd: totalLiquidityUsd.toFixed(2),
      ticketCount: state.globalTicketsBought.toString(),
      drawId: currentId.toString(),
      nextDrawTimestamp: Number(state.drawingTime),
      chainId: 8453,
    };
  } catch (error) {
    console.warn('[OnChainFallback] Failed to read Megapot from chain:', error);
    return null;
  }
}
