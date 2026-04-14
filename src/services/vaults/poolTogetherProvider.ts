/**
 * POOLTOGETHER V5 VAULT PROVIDER
 *
 * Prize savings on Base - users keep 100% principal and win prizes.
 * Uses ERC4626-compatible PrizeVault for deposits/withdrawals.
 */

import { formatUnits, parseUnits } from 'viem';
import { basePublicClient } from '@/lib/baseClient';
import type {
    VaultProvider,
    VaultProtocol,
    VaultBalance,
    VaultDepositResult,
    VaultWithdrawResult,
} from './vaultProvider';
import { VaultError, VaultErrorCode } from './vaultProvider';

const baseClient = basePublicClient;

// PoolTogether V5 PrizeVault on Base (USDC)
// Source: https://dev.pooltogether.com/protocol/deployments/base
const PRIZE_VAULT = '0x6B5a5c55E9dD4bb502Ce25bBfbaA49b69cf7E4dd' as const;

// USDC on Base (6 decimals)
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

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

    // PoolTogether V5 on Base typically yields 2-5% APY from prizes
    const estimatedAPY = 3.5;
    this.cachedAPY = { value: estimatedAPY, timestamp: Date.now() };
    return estimatedAPY;
  }

  async getBalance(userAddress: string): Promise<VaultBalance> {
    try {
      const shares = await baseClient.readContract({
        address: PRIZE_VAULT,
        abi: PRIZE_VAULT_ABI,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      });

      const assets = await baseClient.readContract({
        address: PRIZE_VAULT,
        abi: PRIZE_VAULT_ABI,
        functionName: 'convertToAssets',
        args: [shares],
      });

      const deposited = parseFloat(formatUnits(assets, 6));
      const apy = await this.getCurrentAPY();
      const yieldAccrued = deposited * (apy / 100) * (1 / 365) * 7; // Weekly estimate

      return {
        deposited: deposited.toFixed(6),
        yieldAccrued: yieldAccrued.toFixed(6),
        totalBalance: deposited.toFixed(6),
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
    return {
      success: false,
      error: 'PoolTogether prizes are awarded separately. Withdraw from prize claim interface.',
    };
  }
}

export const poolTogetherProvider = new PoolTogetherVaultProvider();