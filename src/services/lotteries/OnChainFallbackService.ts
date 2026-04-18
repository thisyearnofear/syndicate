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
  {
    name: 'drawPeriodSeconds',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint48' }],
    stateMutability: 'view',
  },
  {
    name: 'getLastAwardedDrawId',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint24' }],
    stateMutability: 'view',
  },
] as const;

// Prize token on Base is WETH (0x4200...0006), 18 decimals.
// We need ETH price to convert prize sizes to USD.
async function getEthPriceUsd(): Promise<number> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    if (!res.ok) return 2400; // fallback
    const data = await res.json();
    return data.ethereum?.usd ?? 2400;
  } catch {
    return 2400; // reasonable fallback
  }
}

/**
 * Read PoolTogether prize data directly from the blockchain
 */
export async function getPoolTogetherOnChainPrize(): Promise<OnChainPrizeData | null> {
  try {
    const [ethPrice, ...results] = await Promise.all([
      getEthPriceUsd(),
      basePublicClient.readContract({
        address: POOLTOGETHER_VAULT_ADDRESS,
        abi: ERC4626_ABI,
        functionName: 'totalAssets',
      } as any).catch(() => BigInt(0)),
      basePublicClient.readContract({
        address: POOLTOGETHER_PRIZE_POOL_ADDRESS,
        abi: PRIZE_POOL_ABI,
        functionName: 'getTierPrizeSize',
        args: [0], // Tier 0 is the Grand Prize
      } as any).catch(() => BigInt(0)),
      basePublicClient.readContract({
        address: POOLTOGETHER_PRIZE_POOL_ADDRESS,
        abi: PRIZE_POOL_ABI,
        functionName: 'getLastAwardedDrawId',
      } as any).catch(() => 0),
      basePublicClient.readContract({
        address: POOLTOGETHER_PRIZE_POOL_ADDRESS,
        abi: PRIZE_POOL_ABI,
        functionName: 'drawPeriodSeconds',
      } as any).catch(() => 86400),
    ]);

    const totalAssets = results[0] as bigint;
    const grandPrizeWeth = results[1] as bigint;
    const lastDrawId = results[2] as number;
    const drawPeriod = results[3] as number;

    const depositsUsd = Number(totalAssets) / 1e6; // USDC vault: 6 decimals

    // Prize token on Base is WETH (18 decimals) — convert to USD
    const grandPrizeEth = Number(grandPrizeWeth) / 1e18;
    const prizeUsd = grandPrizeEth * ethPrice;

    if (depositsUsd <= 0) {
      console.warn('[OnChainFallback] No PoolTogether data available from chain');
      return null;
    }

    if (depositsUsd > 100_000_000) {
      console.warn('[OnChainFallback] PoolTogether data looks invalid (too large):', depositsUsd);
      return null;
    }

    const estimatedPrize = prizeUsd > 0 ? prizeUsd : (depositsUsd * 0.001);

    return {
      prizeUsd: estimatedPrize.toFixed(2),
      totalDepositsUsd: depositsUsd.toFixed(2),
      ticketCount: '0',
      drawId: lastDrawId.toString(),
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
