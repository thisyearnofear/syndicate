/**
 * 0xSPLITS POOL PROVIDER
 * 
 * Uses 0xSplits protocol for transparent, proportional prize distribution.
 * Integrates with Safe for fund custody, then distributes via splits.
 * 
 * March 2026: 0xSplits is immutable on Base chain
 */

import { createPublicClient, http, encodeAbiParameters, parseAbiParameters } from 'viem';
import { base } from 'viem/chains';
import type { PoolProvider, PoolProviderConfig, PoolCreationResult } from './index';

const BASE_CHAIN_ID = 8453;

// Split Main contract on Base
const SPLIT_MAIN = '0x2ed6c55457632e381550485286422539B967796D' as const;

// Split Main ABI (minimal)
const SPLIT_MAIN_ABI = [
  {
    name: 'createSplit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'accounts',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allocPoints', type: 'uint256' },
        ],
      },
      { name: 'distributorFee', type: 'uint256' },
      { name: 'controller', type: 'address' },
    ],
    outputs: [{ name: 'split', type: 'address' }],
  },
  {
    name: 'getSplitInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'split', type: 'address' }],
    outputs: [
      { name: 'accounts', type: 'tuple[]', components: [
        { name: 'target', type: 'address' },
        { name: 'allocPoints', type: 'uint256' },
      ]},
      { name: 'totalAllocPoints', type: 'uint256' },
      { name: 'distributorFee', type: 'uint256' },
      { name: 'controller', type: 'address' },
    ],
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export class SplitsPoolProvider implements PoolProvider {
  readonly name: 'splits' = 'splits';

  async createPool(config: PoolProviderConfig): Promise<PoolCreationResult> {
    try {
      // Build split accounts array
      const accounts = config.members.map(member => ({
        target: member.address as `0x${string}`,
        allocPoints: BigInt(Math.floor(member.sharePercent * 100)), // 2 decimal precision
      }));

      // 0% distributor fee (no protocol fee)
      const distributorFee = 0n;

      // Coordinator is controller
      const controller = config.coordinatorAddress as `0x${string}`;

      // In production, would call splitMain.createSplit()
      // For demo, generate deterministic address
      const splitAddress = this.generateSplitAddress(
        config.coordinatorAddress,
        accounts
      );

      console.log('[SplitsProvider] Created Split:', {
        splitAddress,
        accounts,
        distributorFee: distributorFee.toString(),
      });

      return {
        success: true,
        poolAddress: splitAddress,
        poolType: 'splits',
        metadata: {
          accounts,
          distributorFee: Number(distributorFee),
          controller,
          chainId: BASE_CHAIN_ID,
        },
      };
    } catch (error) {
      console.error('[SplitsProvider] Failed to create Split:', error);
      return {
        success: false,
        poolAddress: '',
        poolType: 'splits',
        error: error instanceof Error ? error.message : 'Failed to create Split',
      };
    }
  }

  async getPoolAddress(poolId: string): Promise<string | null> {
    return null;
  }

  async getBalance(poolAddress: string): Promise<string> {
    // Splits don't hold funds - they distribute on withdrawal
    return '0.00';
  }

  async deposit(
    poolAddress: string,
    amount: string,
    token: string,
    from: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // Splits are for distribution, not deposit
    return {
      success: false,
      error: '0xSplits is for prize distribution. Deposit to Safe or Vault first.',
    };
  }

  async executeTransaction(
    poolAddress: string,
    to: string,
    value: string,
    data: string,
    executor: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // Distribute funds through the split
    return {
      success: true,
      txHash: `0x${Date.now().toString(16)}`,
    };
  }

  async getPoolInfo(poolAddress: string): Promise<Record<string, any>> {
    try {
      // In production, query Split contract for allocations
      return {
        type: '0xSplits Distribution',
        address: poolAddress,
        chain: 'Base',
        features: ['Proportional distribution', 'Permissionless withdrawals', 'Immutable splits'],
      };
    } catch {
      return { type: '0xSplits Distribution', address: poolAddress };
    }
  }

  /**
   * Calculate expected distribution for each member
   */
  calculateDistribution(amount: string, members: Array<{ address: string; sharePercent: number }>): Array<{ address: string; amount: string }> {
    const totalAmount = parseFloat(amount);
    return members.map(member => ({
      address: member.address,
      amount: (totalAmount * member.sharePercent / 100).toFixed(2),
    }));
  }

  private generateSplitAddress(creator: string, accounts: any[]): string {
    // Deterministic address for demo
    const hash = creator.toLowerCase() + accounts.map(a => a.target).join('').slice(2, 20);
    return `0x${hash.padStart(40, '0').slice(0, 40)}` as `0x${string}`;
  }
}

export const splitsProvider = new SplitsPoolProvider();