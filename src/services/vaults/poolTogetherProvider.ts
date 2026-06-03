/**
 * POOLTOGETHER V5 VAULT PROVIDER
 *
 * Prize savings on Base - users keep 100% principal and win prizes.
 * Uses ERC4626-compatible PrizeVault for deposits/withdrawals.
 */

import { formatUnits, parseUnits } from 'viem';
import { basePublicClient } from '@/lib/baseClient';
import { poolTogetherService } from '../lotteries/PoolTogetherService';
import { getNetDepositedAssets } from './erc4626YieldCalculator';
import type {
    VaultProvider,
    VaultProtocol,
    VaultBalance,
    VaultDepositResult,
    VaultWithdrawResult,
} from './vaultProvider';

const baseClient = basePublicClient;

// przUSDC PrizeVault on Base
// https://dev.pooltogether.com/protocol/deployments/base
export const PRIZE_VAULT = '0x7f5C2b379b88499aC2B997Db583f8079503f25b9' as const;

// Chain ID for Base
const BASE_CHAIN_ID = 8453;

// ABIs
const PRIZE_VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export class PoolTogetherVaultProvider implements VaultProvider {
  readonly name: VaultProtocol = 'pooltogether';
  readonly chainId = BASE_CHAIN_ID;

  private cachedAPY: { value: number; timestamp: number } | null = null;
  private readonly APY_CACHE_TTL = 5 * 60 * 1000;

  async isHealthy(): Promise<boolean> {
    try {
      await baseClient.readContract({
        address: PRIZE_VAULT,
        abi: PRIZE_VAULT_ABI,
        functionName: 'totalAssets',
      });
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentAPY(): Promise<number> {
    if (this.cachedAPY && Date.now() - this.cachedAPY.timestamp < this.APY_CACHE_TTL) {
      return this.cachedAPY.value;
    }

    try {
      // Fetch live prize data from PoolTogether service (using reliable API)
      const prizeData = await poolTogetherService.getPrizeData();
      if (prizeData && prizeData.apy > 0) {
        this.cachedAPY = { value: prizeData.apy, timestamp: Date.now() };
        return prizeData.apy;
      }
    } catch (error) {
      console.warn('[PoolTogetherVault] Failed to get live APY, using fallback:', error);
    }

    // Fallback: PoolTogether V5 on Base typically yields 2-5% APY from prizes
    const estimatedAPY = 3.5;
    this.cachedAPY = { value: estimatedAPY, timestamp: Date.now() };
    return estimatedAPY;
  }

  async getBalance(userAddress: string): Promise<VaultBalance> {
    try {
      const userAddr = userAddress as `0x${string}`;
      
      const shares = await baseClient.readContract({
        address: PRIZE_VAULT,
        abi: PRIZE_VAULT_ABI,
        functionName: 'balanceOf',
        args: [userAddr],
      });

      const assets = await baseClient.readContract({
        address: PRIZE_VAULT,
        abi: PRIZE_VAULT_ABI,
        functionName: 'convertToAssets',
        args: [shares],
      });

      const currentTotalBalance = parseFloat(formatUnits(assets, 6));
      const apy = await this.getCurrentAPY();
      
      // Calculate actual historical yield using on-chain events
      const netDepositResult = await getNetDepositedAssets(
        PRIZE_VAULT,
        userAddr,
        6
      );

      let yieldAccrued = 0;
      let deposited = currentTotalBalance;

      if (netDepositResult.success && netDepositResult.netDepositedAssets > 0) {
        deposited = netDepositResult.netDepositedAssets;
        yieldAccrued = Math.max(0, currentTotalBalance - deposited);
      } else if (currentTotalBalance > 0) {
        // Fallback: If events couldn't be fetched but user has a balance,
        // we can't accurately determine principal. Use a conservative estimate.
        yieldAccrued = currentTotalBalance * (apy / 100) * (1 / 365) * 7;
      }

      return {
        deposited: deposited.toFixed(6),
        yieldAccrued: yieldAccrued.toFixed(6),
        totalBalance: currentTotalBalance.toFixed(6),
        apy,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error('[PoolTogetherVault] Failed to get balance:', error);
      return {
        deposited: '0',
        yieldAccrued: '0',
        totalBalance: '0',
        apy: 0,
        lastUpdated: Date.now(),
      };
    }
  }

  async getYieldAccrued(userAddress: string): Promise<string> {
    const balance = await this.getBalance(userAddress);
    return balance.yieldAccrued;
  }

  async deposit(amount: string, userAddress: string): Promise<VaultDepositResult> {
    const amountWei = parseUnits(amount, 6);
    return {
      success: true,
      txData: JSON.stringify({
        vault: PRIZE_VAULT,
        amount: amountWei.toString(),
        receiver: userAddress,
        action: 'deposit',
      }),
    };
  }

  async withdraw(amount: string, userAddress: string): Promise<VaultWithdrawResult> {
    const amountWei = parseUnits(amount, 6);
    return {
      success: true,
      txData: JSON.stringify({
        vault: PRIZE_VAULT,
        amount: amountWei.toString(),
        receiver: userAddress,
        owner: userAddress,
        action: 'withdraw',
      }),
      amountWithdrawn: amount,
    };
  }

  async withdrawYield(userAddress: string): Promise<VaultWithdrawResult> {
    try {
      // PoolTogether V5 prizes are claimed automatically by bots.
      // For the vault balance, we estimate yield via the share-to-assets ratio
      // similar to other ERC4626 vaults.
      const shares = await baseClient.readContract({
        address: PRIZE_VAULT,
        abi: PRIZE_VAULT_ABI,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      });

      if (shares === 0n) {
        return { success: false, error: 'No balance in vault' };
      }

      const assets = await baseClient.readContract({
        address: PRIZE_VAULT,
        abi: PRIZE_VAULT_ABI,
        functionName: 'convertToAssets',
        args: [shares],
      });

      let yieldAmount = '0';
      // For PrizeVaults, yield comes as prizes (not interest), so we estimate
      // based on the APY and time since deposit
      const apy = await this.getCurrentAPY();
      if (apy > 0) {
        // Weekly yield estimate
        const estimatedYield = parseFloat(formatUnits(assets, 6)) * (apy / 100) * (1 / 52);
        yieldAmount = estimatedYield.toFixed(6);
      }

      if (parseFloat(yieldAmount) <= 0) {
        return {
          success: false,
          error: 'No yield available to withdraw',
        };
      }

      return this.withdraw(yieldAmount, userAddress);
    } catch (error) {
      console.error('[PoolTogetherVault] Failed to withdraw yield:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to withdraw yield',
      };
    }
  }
}

export const poolTogetherProvider = new PoolTogetherVaultProvider();