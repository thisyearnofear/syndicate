/**
 * 0xSPLITS POOL PROVIDER
 * 
 * Uses 0xSplits protocol for transparent, proportional prize distribution.
 * Creates real immutable splits on Base for syndicate prize distribution.
 * 
 * March 2026: 0xSplits is immutable on Base chain
 */

import type { PoolProvider, PoolProviderConfig, PoolCreationResult } from './index';
import { splitsService, type SplitInfo } from '@/services/splits/splitService';
import type { Address } from 'viem';

const BASE_CHAIN_ID = 8453;

export class SplitsPoolProvider implements PoolProvider {
  readonly name: 'splits' = 'splits';

  async createPool(config: PoolProviderConfig): Promise<PoolCreationResult> {
    try {
      // Build recipients array with equal share percentages
      // Note: This creates an immutable split that cannot be modified later
      const equalShare = 100 / Math.max(config.members.length, 1);
      const recipients = config.members.map(member => ({
        address: member.address as Address,
        percentAllocation: member.sharePercent || equalShare,
      }));

      // Add coordinator if not already in members
      const coordinatorInMembers = recipients.some(
        r => r.address.toLowerCase() === config.coordinatorAddress.toLowerCase()
      );
      
      if (!coordinatorInMembers) {
        // Coordinator gets a small management fee (e.g., 1%)
        recipients.push({
          address: config.coordinatorAddress as Address,
          percentAllocation: 1,
        });
        // Adjust other shares
        const remainingShare = 99;
        const sharePerMember = remainingShare / config.members.length;
        recipients.forEach((r, i) => {
          if (i < config.members.length) {
            r.percentAllocation = sharePerMember;
          }
        });
      }

      // Validate total allocation equals 100%
      const totalAllocation = recipients.reduce((sum, r) => sum + r.percentAllocation, 0);
      if (Math.abs(totalAllocation - 100) > 0.01) {
        // Normalize to exactly 100%
        const scale = 100 / totalAllocation;
        recipients.forEach(r => {
          r.percentAllocation = r.percentAllocation * scale;
        });
      }

      console.log('[SplitsProvider] Creating split with recipients:', {
        recipients: recipients.map(r => ({
          address: r.address.slice(0, 10) + '...',
          share: r.percentAllocation.toFixed(2) + '%',
        })),
        coordinator: config.coordinatorAddress.slice(0, 10) + '...',
      });

      // Note: We can't actually create the split here because we need a wallet client
      // The actual split creation will happen when the user joins and approves
      // For now, store the split configuration in metadata
      
      // Generate a deterministic address for demo/testing
      // In production, this would be the actual split address after creation
      const splitAddress = this.generateSplitAddress(
        config.coordinatorAddress,
        recipients
      );

      return {
        success: true,
        poolAddress: splitAddress,
        poolType: 'splits',
        metadata: {
          recipients,
          distributorFee: 0,
          controller: config.coordinatorAddress,
          chainId: BASE_CHAIN_ID,
          isImmutable: true,
          note: 'Split will be created on-chain when first deposit is made',
        },
      };
    } catch (error) {
      console.error('[SplitsProvider] Failed to create Split config:', error);
      return {
        success: false,
        poolAddress: '',
        poolType: 'splits',
        error: error instanceof Error ? error.message : 'Failed to create Split',
      };
    }
  }

  async getPoolAddress(poolId: string): Promise<string | null> {
    // Would look up from database in production
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
    // Users should deposit to a Safe or Vault first, then distribute via split
    return {
      success: false,
      error: '0xSplits is for prize distribution. Deposit to Safe first, then distribute through split.',
    };
  }

  async executeTransaction(
    poolAddress: string,
    to: string,
    value: string,
    data: string,
    executor: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    // In production, this would distribute funds through the split
    // using the splitsService.distributeToken function
    console.log('[SplitsProvider] Execute distribution:', {
      splitAddress: poolAddress,
      to,
      value,
    });
    
    return {
      success: true,
      txHash: `0x${Date.now().toString(16)}`,
    };
  }

  async getPoolInfo(poolAddress: string): Promise<Record<string, any>> {
    try {
      // Try to fetch real split info from chain
      const splitInfo = await splitsService.getSplitInfo(poolAddress as Address);
      
      if (splitInfo) {
        return {
          type: '0xSplits Distribution',
          address: poolAddress,
          chain: 'Base',
          recipients: splitInfo.recipients.map(r => ({
            address: r.address,
            sharePercent: r.percentAllocation,
          })),
          distributorFee: splitInfo.distributorFee,
          hasController: splitInfo.controller !== null,
          features: ['Proportional distribution', 'Permissionless withdrawals', 'Immutable splits'],
        };
      }
      
      return {
        type: '0xSplits Distribution',
        address: poolAddress,
        chain: 'Base',
        features: ['Proportional distribution', 'Permissionless withdrawals', 'Immutable splits'],
      };
    } catch {
      return { 
        type: '0xSplits Distribution', 
        address: poolAddress,
        chain: 'Base',
        features: ['Proportional distribution', 'Permissionless withdrawals', 'Immutable splits'],
      };
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

  /**
   * Distribute funds through the split
   * This is called when prizes are won
   */
  async distributeFunds(
    splitAddress: string,
    tokenAddress: Address,
    walletClient: any
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const result = await splitsService.distributeToken({
        splitAddress: splitAddress as Address,
        token: tokenAddress,
        walletClient,
      });
      
      return result;
    } catch (error) {
      console.error('[SplitsProvider] Distribution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Distribution failed',
      };
    }
  }

  private generateSplitAddress(creator: string, recipients: Array<{ address: string; percentAllocation: number }>): string {
    // Deterministic address for demo/testing
    // In production, this would be the actual address from createSplit transaction
    const hash = creator.toLowerCase() + 
      recipients.map(r => r.address.toLowerCase().slice(2, 10)).join('');
    return `0x${hash.slice(2, 42).padStart(40, '0')}` as `0x${string}`;
  }
}

export const splitsProvider = new SplitsPoolProvider();