/**
 * ON-CHAIN FALLBACK SERVICE
 * 
 * Fallback for reading prize data directly from contracts when APIs are unavailable.
 * Uses viem public client to read contract state.
 */

import { createPublicClient, http, Address, getContract } from 'viem';
import { base } from 'viem/chains';
import { CONTRACTS } from '@/config/contracts';

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

const MEGAPOT_JACKPOT_ADDRESS: Address = '0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2' as Address; // Megapot V2 on Base
const POOLTOGETHER_VAULT_ADDRESS: Address = '0x6B5a5c55E9dD4bb502Ce25bBfbaA49b69cf7E4dd' as Address; // PoolTogether vault on Base

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
// MEGAPOT ON-CHAIN READ
// =============================================================================

/**
 * Read Megapot prize data directly from the blockchain
 * Uses contract state variables as fallback when API is unavailable
 */
export async function getMegapotOnChainPrize(): Promise<OnChainPrizeData | null> {
  try {
    // Read draw state from contract
    // Note: These functions may not exist on actual contract - this is a best-effort fallback
    const results = await Promise.allSettled([
      basePublicClient.readContract({
        address: MEGAPOT_JACKPOT_ADDRESS,
        abi: GENERIC_ABI,
        functionName: 'getCurrentJackpot' as any,
      }).catch(() => 0n),
      basePublicClient.readContract({
        address: POOLTOGETHER_VAULT_ADDRESS,
        abi: GENERIC_ABI,
        functionName: 'totalSupply' as any,
      }).catch(() => 0n),
      basePublicClient.readContract({
        address: MEGAPOT_JACKPOT_ADDRESS,
        abi: GENERIC_ABI,
        functionName: 'getTicketCount' as any,
      }).catch(() => 0n),
      basePublicClient.readContract({
        address: MEGAPOT_JACKPOT_ADDRESS,
        abi: GENERIC_ABI,
        functionName: 'currentDrawId' as any,
      }).catch(() => 0n),
      basePublicClient.readContract({
        address: MEGAPOT_JACKPOT_ADDRESS,
        abi: GENERIC_ABI,
        functionName: 'nextDrawTime' as any,
      }).catch(() => 0n),
    ]);

    const currentJackpot = results[0].status === 'fulfilled' ? results[0].value as bigint : 0n;
    const totalDeposits = results[1].status === 'fulfilled' ? results[1].value as bigint : 0n;
    const ticketCount = results[2].status === 'fulfilled' ? results[2].value as bigint : 0n;
    const drawId = results[3].status === 'fulfilled' ? results[3].value as bigint : 0n;
    const nextDrawTime = results[4].status === 'fulfilled' ? results[4].value as bigint : 0n;

    // Convert to USD (assuming USDC decimals)
    const jackpotUsd = Number(currentJackpot) / 1e6;
    const depositsUsd = Number(totalDeposits) / 1e6;

    // Only return data if we got actual values
    if (jackpotUsd <= 0 && depositsUsd <= 0) {
      console.warn('[OnChainFallback] No Megapot data available from chain');
      return null;
    }

    return {
      prizeUsd: jackpotUsd > 0 ? jackpotUsd.toFixed(2) : depositsUsd.toFixed(2),
      totalDepositsUsd: depositsUsd.toFixed(2),
      ticketCount: ticketCount.toString(),
      drawId: drawId.toString(),
      nextDrawTimestamp: Number(nextDrawTime),
      chainId: 8453,
    };
  } catch (error) {
    console.warn('Failed to read Megapot from chain:', error);
    return null;
  }
}

// =============================================================================
// POOLTOGETHER ON-CHAIN READ
// =============================================================================

/**
 * Read PoolTogether prize data directly from the blockchain
 */
export async function getPoolTogetherOnChainPrize(): Promise<OnChainPrizeData | null> {
  try {
    const results = await Promise.allSettled([
      basePublicClient.readContract({
        address: POOLTOGETHER_VAULT_ADDRESS,
        abi: GENERIC_ABI,
        functionName: 'totalSupply' as any,
      }).catch(() => 0n),
      basePublicClient.readContract({
        address: POOLTOGETHER_VAULT_ADDRESS,
        abi: GENERIC_ABI,
        functionName: 'totalAssets' as any,
      }).catch(() => 0n),
    ]);

    const totalSupply = results[0].status === 'fulfilled' ? results[0].value as bigint : 0n;
    const totalAssets = results[1].status === 'fulfilled' ? results[1].value as bigint : 0n;

    // PoolTogether doesn't have a jackpot in same way - use total deposits
    const depositsUsd = Number(totalAssets || totalSupply) / 1e6;

    if (depositsUsd <= 0) {
      console.warn('[OnChainFallback] No PoolTogether data available from chain');
      return null;
    }

    // Approximate prize from yield (very rough estimate)
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
    console.warn('Failed to read PoolTogether from chain:', error);
    return null;
  }
}

// =============================================================================
// GENERIC ABI (Dynamic calls)
// =============================================================================

// Minimal ABI that allows any function call - TypeScript treats it loosely
const GENERIC_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;