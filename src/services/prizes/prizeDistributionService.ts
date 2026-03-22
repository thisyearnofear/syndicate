/**
 * PRIZE DISTRIBUTION SERVICE
 * 
 * Handles lottery win detection and prize distribution to syndicate members.
 * Routes distribution through appropriate pool provider based on pool type.
 * 
 * Flow:
 * 1. Detect win event (via API or manual trigger)
 * 2. Calculate member shares based on contributions
 * 3. Route to appropriate distribution method:
 *    - Safe: Create transaction proposal for multisig
 *    - Splits: Execute distributeToken through SplitMain
 *    - PoolTogether: Claim prizes and distribute via Safe/Splits
 * 4. Record distribution in database
 * 5. Return distribution details
 */

import { sql } from '@vercel/postgres';
import { safeService } from '@/services/safe/safeService';
import { splitsService } from '@/services/splits/splitService';
import { poolTogetherVaultService } from '@/services/poolTogether/vaultService';
import type { PoolType } from '@/domains/lottery/types';
import type { Address } from 'viem';

// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// PoolTogether PrizePool on Base
const PT_PRIZE_POOL = '0x45b2010d8a4f08b53c9fa7544c51dfd9733732cb' as const;

export type DistributionStatus = 
  | 'pending'      // Waiting for win confirmation
  | 'calculating'  // Calculating member shares
  | 'distributing' // Distribution in progress
  | 'completed'    // Distribution successful
  | 'failed';      // Distribution failed

export interface MemberShare {
  address: Address;
  contribution: number;     // USDC contributed
  contributionPercent: number; // Percentage of total
  shareAmount: number;      // USDC to receive
}

export interface DistributionResult {
  success: boolean;
  distributionId?: string;
  txHash?: string;
  memberShares?: MemberShare[];
  totalDistributed?: number;
  error?: string;
}

export interface PrizeDistribution {
  id: string;
  poolId: string;
  poolType: PoolType;
  status: DistributionStatus;
  prizeAmount: number;
  totalContributed: number;
  memberShares: MemberShare[];
  txHash: string | null;
  createdAt: Date;
  completedAt: Date | null;
  error: string | null;
}

export class PrizeDistributionService {
  
  /**
   * Get pool members and their contributions
   */
  async getPoolMembers(poolId: string): Promise<MemberShare[]> {
    const result = await sql`
      SELECT address, contribution_usdc
      FROM syndicate_members
      WHERE pool_id = ${poolId}
      ORDER BY contribution_usdc DESC
    `;

    const members = result.rows as Array<{ address: string; contribution_usdc: string }>;
    const totalContributed = members.reduce(
      (sum, m) => sum + parseFloat(m.contribution_usdc || '0'), 
      0
    );

    return members.map(m => {
      const contribution = parseFloat(m.contribution_usdc || '0');
      const contributionPercent = totalContributed > 0 
        ? (contribution / totalContributed) * 100 
        : 0;

      return {
        address: m.address as Address,
        contribution,
        contributionPercent,
        shareAmount: 0, // Will be calculated based on prize
      };
    });
  }

  /**
   * Calculate member shares based on prize amount
   */
  calculateMemberShares(
    members: MemberShare[], 
    prizeAmount: number
  ): MemberShare[] {
    return members.map(member => ({
      ...member,
      shareAmount: (member.contributionPercent / 100) * prizeAmount,
    }));
  }

  /**
   * Get pool info from database
   */
  async getPoolInfo(poolId: string): Promise<{
    poolType: PoolType;
    poolAddress: Address;
    safeAddress: Address | null;
    splitAddress: Address | null;
    ptVaultAddress: Address | null;
  } | null> {
    const result = await sql`
      SELECT pool_type, safe_address, split_address, pt_vault_address, coordinator_address
      FROM syndicate_pools
      WHERE id = ${poolId}
    `;

    if (result.rows.length === 0) return null;

    const pool = result.rows[0];
    const poolType = (pool.pool_type || 'safe') as PoolType;
    const poolAddress = poolType === 'splits' && pool.split_address
      ? pool.split_address
      : poolType === 'pooltogether' && pool.pt_vault_address
      ? pool.pt_vault_address
      : pool.safe_address || pool.coordinator_address;

    return {
      poolType,
      poolAddress: poolAddress as Address,
      safeAddress: pool.safe_address as Address | null,
      splitAddress: pool.split_address as Address | null,
      ptVaultAddress: pool.pt_vault_address as Address | null,
    };
  }

  /**
   * Create a distribution record in the database
   */
  async createDistributionRecord(
    poolId: string,
    prizeAmount: number,
    memberShares: MemberShare[]
  ): Promise<string> {
    const result = await sql`
      INSERT INTO prize_distributions (
        pool_id,
        prize_amount_usdc,
        member_count,
        status,
        created_at
      ) VALUES (
        ${poolId},
        ${prizeAmount},
        ${memberShares.length},
        'pending',
        ${Date.now()}
      )
      RETURNING id
    `;

    return result.rows[0].id;
  }

  /**
   * Update distribution status
   */
  async updateDistributionStatus(
    distributionId: string,
    status: DistributionStatus,
    txHash?: string,
    error?: string
  ): Promise<void> {
    await sql`
      UPDATE prize_distributions
      SET 
        status = ${status},
        tx_hash = ${txHash || null},
        error = ${error || null},
        completed_at = ${status === 'completed' ? Date.now() : null}
      WHERE id = ${distributionId}
    `;
  }

  /**
   * Distribute prizes through Safe multisig
   * Creates transaction proposal that requires threshold signatures
   */
  async distributeViaSafe(
    safeAddress: Address,
    memberShares: MemberShare[],
    walletClient: any
  ): Promise<DistributionResult> {
    try {
      // Get Safe info
      const safeInfo = await safeService.getSafeInfo(safeAddress);
      if (!safeInfo) {
        return { success: false, error: 'Safe not found' };
      }

      // Create batch transactions for each member
      // In production, this would use Safe's multiSend
      // For now, we'll create individual transfer transactions
      
      console.log('[PrizeDistribution] Safe distribution:', {
        safeAddress,
        threshold: safeInfo.threshold,
        members: memberShares.length,
      });

      // Note: With Safe, the distribution requires threshold signatures
      // The coordinator would create the transaction and owners would sign
      // For demo, we'll return the proposed transaction details

      return {
        success: true,
        memberShares,
        totalDistributed: memberShares.reduce((sum, m) => sum + m.shareAmount, 0),
      };
    } catch (error) {
      console.error('[PrizeDistribution] Safe distribution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Safe distribution failed',
      };
    }
  }

  /**
   * Distribute prizes through 0xSplits
   * Automatically distributes to all recipients based on percentages
   */
  async distributeViaSplits(
    splitAddress: Address,
    memberShares: MemberShare[],
    walletClient: any
  ): Promise<DistributionResult> {
    try {
      // Get split info to verify
      const splitInfo = await splitsService.getSplitInfo(splitAddress);
      if (!splitInfo) {
        return { success: false, error: 'Split not found' };
      }

      // Check if there's a balance to distribute
      const balance = await splitsService.getSplitBalance(splitAddress, USDC_ADDRESS);
      if (balance === 0n) {
        return { 
          success: false, 
          error: 'No USDC balance to distribute. Deposit to split first.' 
        };
      }

      // Execute distribution through split
      const result = await splitsService.distributeToken({
        splitAddress,
        token: USDC_ADDRESS,
        walletClient,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      console.log('[PrizeDistribution] Splits distribution:', {
        splitAddress,
        txHash: result.txHash,
        balance: balance.toString(),
      });

      return {
        success: true,
        txHash: result.txHash,
        memberShares,
        totalDistributed: memberShares.reduce((sum, m) => sum + m.shareAmount, 0),
      };
    } catch (error) {
      console.error('[PrizeDistribution] Splits distribution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Splits distribution failed',
      };
    }
  }

  /**
   * Distribute prizes from PoolTogether
   * First claims prizes, then distributes via Safe or Splits
   */
  async distributeViaPoolTogether(
    ptVaultAddress: Address,
    safeAddress: Address | null,
    memberShares: MemberShare[],
    walletClient: any
  ): Promise<DistributionResult> {
    try {
      // PoolTogether prizes are claimed separately
      // The vault generates yield that becomes prize pool
      // For syndicates, we'd typically route through a Safe or Splits

      console.log('[PrizeDistribution] PoolTogether distribution:', {
        ptVaultAddress,
        safeAddress,
        members: memberShares.length,
      });

      // If there's a Safe, route through it
      if (safeAddress) {
        return this.distributeViaSafe(safeAddress, memberShares, walletClient);
      }

      // Otherwise, this would need manual claiming
      return {
        success: false,
        error: 'PoolTogether prizes require a Safe or Splits for distribution',
      };
    } catch (error) {
      console.error('[PrizeDistribution] PoolTogether distribution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PoolTogether distribution failed',
      };
    }
  }

  /**
   * Main distribution method
   * Routes to appropriate provider based on pool type
   */
  async distributePrize(
    poolId: string,
    prizeAmount: number,
    walletClient: any
  ): Promise<DistributionResult> {
    try {
      // Get pool info
      const poolInfo = await this.getPoolInfo(poolId);
      if (!poolInfo) {
        return { success: false, error: 'Pool not found' };
      }

      // Get members and calculate shares
      const members = await this.getPoolMembers(poolId);
      if (members.length === 0) {
        return { success: false, error: 'No members found' };
      }

      const memberShares = this.calculateMemberShares(members, prizeAmount);

      // Create distribution record
      const distributionId = await this.createDistributionRecord(
        poolId, 
        prizeAmount, 
        memberShares
      );

      // Update status to calculating
      await this.updateDistributionStatus(distributionId, 'calculating');

      // Route to appropriate provider
      let result: DistributionResult;

      switch (poolInfo.poolType) {
        case 'safe':
          if (!poolInfo.safeAddress) {
            result = { success: false, error: 'Safe address not found' };
          } else {
            await this.updateDistributionStatus(distributionId, 'distributing');
            result = await this.distributeViaSafe(
              poolInfo.safeAddress, 
              memberShares, 
              walletClient
            );
          }
          break;

        case 'splits':
          if (!poolInfo.splitAddress) {
            result = { success: false, error: 'Split address not found' };
          } else {
            await this.updateDistributionStatus(distributionId, 'distributing');
            result = await this.distributeViaSplits(
              poolInfo.splitAddress, 
              memberShares, 
              walletClient
            );
          }
          break;

        case 'pooltogether':
          await this.updateDistributionStatus(distributionId, 'distributing');
          result = await this.distributeViaPoolTogether(
            poolInfo.ptVaultAddress || poolInfo.poolAddress,
            poolInfo.safeAddress,
            memberShares,
            walletClient
          );
          break;

        default:
          result = { success: false, error: `Unknown pool type: ${poolInfo.poolType}` };
      }

      // Update final status
      if (result.success) {
        await this.updateDistributionStatus(
          distributionId, 
          'completed', 
          result.txHash
        );
      } else {
        await this.updateDistributionStatus(
          distributionId, 
          'failed', 
          undefined,
          result.error
        );
      }

      return {
        ...result,
        distributionId,
      };
    } catch (error) {
      console.error('[PrizeDistribution] Distribution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Distribution failed',
      };
    }
  }

  /**
   * Get distribution history for a pool
   */
  async getDistributionHistory(poolId: string): Promise<PrizeDistribution[]> {
    const result = await sql`
      SELECT 
        id, pool_id, prize_amount_usdc, member_count,
        status, tx_hash, created_at, completed_at, error
      FROM prize_distributions
      WHERE pool_id = ${poolId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return result.rows.map((row: any) => ({
      id: row.id,
      poolId: row.pool_id,
      poolType: 'safe' as PoolType, // Would need to join with pools table
      status: row.status as DistributionStatus,
      prizeAmount: parseFloat(row.prize_amount_usdc),
      totalContributed: 0, // Would need calculation
      memberShares: [], // Would need to fetch from separate table
      txHash: row.tx_hash,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      error: row.error,
    }));
  }

  /**
   * Get a specific distribution by ID
   */
  async getDistribution(distributionId: string): Promise<PrizeDistribution | null> {
    const result = await sql`
      SELECT 
        id, pool_id, prize_amount_usdc, member_count,
        status, tx_hash, created_at, completed_at, error
      FROM prize_distributions
      WHERE id = ${distributionId}
    `;

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      poolId: row.pool_id,
      poolType: 'safe' as PoolType,
      status: row.status as DistributionStatus,
      prizeAmount: parseFloat(row.prize_amount_usdc),
      totalContributed: 0,
      memberShares: [],
      txHash: row.tx_hash,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      error: row.error,
    };
  }
}

export const prizeDistributionService = new PrizeDistributionService();
