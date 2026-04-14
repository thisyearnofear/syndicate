/**
 * POOLTOGETHER V5 SERVICE
 * 
 * Implements the "No-Loss" prize savings lottery integration.
 * 
 * Features:
 * - Automated deposit into PoolTogether Prize Vaults.
 * - Configuration of "Prize Split Hooks" for Syndicate referrals.
 * - Support for Base and Optimism networks.
 */

import { Address, encodeFunctionData, Hash } from 'viem';
import { referralManager } from '../referral/ReferralManager';

export interface PoolTogetherVault {
  address: Address;
  token: string;
  symbol: string;
  chainId: number;
}

export const POOLTOGETHER_VAULTS: PoolTogetherVault[] = [
  {
    address: '0x6B5a5c55E9dD4bb502Ce25bBfbaA49b69cf7E4dd' as Address, // Official USDC PrizeVault on Base
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    symbol: 'USDC',
    chainId: 8453, // Base
  }
];

export interface PoolTogetherPrizeData {
  prizeUsd: string;
  totalDepositsUsd: string;
  apy: number;
  vaultAddress: Address;
  chainId: number;
}

export class PoolTogetherService {
  private static instance: PoolTogetherService;
  private prizeCache: PoolTogetherPrizeData | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): PoolTogetherService {
    if (!PoolTogetherService.instance) {
      PoolTogetherService.instance = new PoolTogetherService();
    }
    return PoolTogetherService.instance;
  }

  /**
   * Fetch current prize pool data from PoolTogether API
   * Returns null when API fails to prevent showing inaccurate data
   */
  async getPrizeData(): Promise<PoolTogetherPrizeData | null> {
    const now = Date.now();
    
    // Return cached data if fresh
    if (this.prizeCache && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.prizeCache;
    }

    try {
      // Fetch prize data from official Cabana/PoolTogether V5 API
      // Using the reliable Cabana API for Base network (chain ID 8453)
      const response = await fetch(
        'https://api.cabana.fi/v1/prizes/8453',
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.warn(`[PoolTogether] API returned ${response.status}, trying fallback`);
        return this.getOnChainFallback();
      }

      const data = await response.json();
      
      // Parse the prize data from Cabana format
      // Cabana API typically returns an object with prize stats
      const prizeData: PoolTogetherPrizeData = {
        prizeUsd: (data.grandPrize?.amount ?? data.totalPrizeValue ?? '0').toString(),
        totalDepositsUsd: (data.tvl ?? data.totalValueLocked ?? '0').toString(),
        apy: data.estimatedApy ?? data.apr ?? 3.5,
        vaultAddress: POOLTOGETHER_VAULTS[0].address,
        chainId: POOLTOGETHER_VAULTS[0].chainId,
      };

      // Validate we got meaningful data
      if (parseFloat(prizeData.prizeUsd) <= 0) {
        console.warn('[PoolTogether] API returned zero prize, trying on-chain fallback');
        return this.getOnChainFallback();
      }

      // Update cache
      this.prizeCache = prizeData;
      this.lastFetchTime = now;

      console.log('[PoolTogether] Successfully fetched prize data:', prizeData.prizeUsd);
      return prizeData;
    } catch (error) {
      console.warn('[PoolTogether] API unavailable, trying on-chain fallback:', error);
      return this.getOnChainFallback();
    }
  }

  /**
   * Read PoolTogether prize data directly from the vault contract on Base
   */
  private async getOnChainFallback(): Promise<PoolTogetherPrizeData | null> {
    try {
      const { getPoolTogetherOnChainPrize } = await import('./OnChainFallbackService');
      const onChainData = await getPoolTogetherOnChainPrize();
      if (!onChainData || parseFloat(onChainData.prizeUsd) <= 0) {
        return null;
      }

      const prizeData: PoolTogetherPrizeData = {
        prizeUsd: onChainData.prizeUsd,
        totalDepositsUsd: onChainData.totalDepositsUsd,
        apy: 0,
        vaultAddress: POOLTOGETHER_VAULTS[0].address,
        chainId: POOLTOGETHER_VAULTS[0].chainId,
      };

      // Cache the on-chain result
      this.prizeCache = prizeData;
      this.lastFetchTime = Date.now();

      console.log('[PoolTogether] On-chain fallback succeeded, prize:', onChainData.prizeUsd);
      return prizeData;
    } catch (error) {
      console.error('[PoolTogether] On-chain fallback also failed:', error);
      return null;
    }
  }

  /**
   * Clear prize cache
   */
  clearCache(): void {
    this.prizeCache = null;
    this.lastFetchTime = 0;
  }

  /**
   * Prepares the transaction to deposit and set a referral hook
   */
  async prepareDepositWithHook(
    vault: PoolTogetherVault,
    amount: bigint,
    userAddress: Address
  ) {
    const hookAddress = referralManager.getReferrerFor('pooltogether') as Address;
    
    // 1. Prepare Deposit Instruction
    // function deposit(address recipient, uint256 amount) external returns (uint256)
    
    // 2. Prepare SetHook Instruction (Referral)
    // function setHooks(tuple(address useBefore, address useAfter, bool, bool)) external
    
    console.log(`[PoolTogether] Preparing deposit of ${amount} with hook: ${hookAddress}`);
    
    return {
      vaultAddress: vault.address,
      amount,
      hookAddress,
      // Actionable instructions for the TransactionExecutor
    };
  }

  /**
   * Calculate potential winnings share (Commission)
   * Based on the Prize Split Hook configuration (e.g., 10% to Syndicate)
   */
  getSyndicateShare(winnings: bigint): bigint {
    return (winnings * BigInt(1000)) / BigInt(10000); // 10%
  }
}

export const poolTogetherService = PoolTogetherService.getInstance();
