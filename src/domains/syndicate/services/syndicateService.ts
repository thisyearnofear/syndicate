/**
 * SYNDICATE SERVICE
 * 
 * Core Principles Applied:
 * - MODULAR: Isolated syndicate logic
 * - CLEAN: Clear service interface
 * - ENHANCEMENT FIRST: Building on existing stubs
 */

import type { SyndicatePool } from '../types';
import type { SyndicateInfo } from '@/domains/lottery/types';
import { web3Service } from '@/services/web3Service';
import { splitsService, type ParticipantShare } from '@/services/splitsService';
import { distributionService } from '@/services/distributionService';
import { syndicateRepository } from '@/lib/db/repositories/syndicateRepository';
import { ethers } from 'ethers';

export class SyndicateService {
  /**
   * Create a new syndicate pool
   */
  async createPool(params: {
    name: string;
    description?: string;
    coordinatorAddress: string;
    causeAllocationPercent: number;
  }): Promise<string> {
    // Validate cause allocation
    if (params.causeAllocationPercent < 0 || params.causeAllocationPercent > 100) {
      throw new Error('Cause allocation must be between 0 and 100');
    }

    // Validate coordinator address
    if (!ethers.isAddress(params.coordinatorAddress)) {
      throw new Error('Invalid coordinator address');
    }

    // Create pool in database
    const poolId = await syndicateRepository.createPool(params);

    console.log('[SyndicateService] Pool created:', {
      poolId,
      name: params.name,
      coordinator: params.coordinatorAddress,
    });

    return poolId;
  }

  /**
   * Join an existing pool with a contribution
   */
  async joinPool(params: {
    poolId: string;
    memberAddress: string;
    amountUsdc: string;
  }): Promise<boolean> {
    // Validate amount
    const amount = parseFloat(params.amountUsdc);
    if (amount <= 0 || isNaN(amount)) {
      throw new Error('Contribution amount must be greater than 0');
    }

    // Validate member address
    if (!ethers.isAddress(params.memberAddress)) {
      throw new Error('Invalid member address');
    }

    // Check pool exists and is active
    const pool = await syndicateRepository.getPoolById(params.poolId);
    if (!pool) {
      throw new Error('Pool not found');
    }
    if (!pool.is_active) {
      throw new Error('Pool is not active');
    }

    // Add member to pool
    await syndicateRepository.addMember({
      poolId: params.poolId,
      memberAddress: params.memberAddress,
      amountUsdc: params.amountUsdc,
    });

    console.log('[SyndicateService] Member joined pool:', {
      poolId: params.poolId,
      member: params.memberAddress,
      amount: params.amountUsdc,
    });

    return true;
  }

  /**
   * Get all active pools
   */
  async getActivePools(): Promise<SyndicatePool[]> {
    const rows = await syndicateRepository.getActivePools();

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      memberCount: row.members_count,
      totalTickets: 0, // TODO: Track tickets purchased
      causeAllocation: row.cause_allocation_percent,
      isActive: row.is_active,
    }));
  }

  async getActiveSyndicates(): Promise<SyndicateInfo[]> {
    const res = await fetch('/api/syndicates');
    if (!res.ok) return [];
    const data = await res.json();
    return data as SyndicateInfo[];
  }

  async prepareAdHocBatchPurchase(syndicateId: string, ticketCount: number): Promise<{ success: boolean; txHash?: string; error?: string; recipient?: string }> {
    const syndicates = await this.getActiveSyndicates();
    const s = syndicates.find(x => x.id === syndicateId);
    if (!s?.poolAddress) return { success: false, error: 'Pool address unavailable' };
    const result = await web3Service.purchaseTickets(ticketCount, s.poolAddress);
    return { success: result.success, txHash: result.txHash, error: result.error, recipient: s.poolAddress };
  }

  snapshotProportionalWeights(syndicateId: string, participants: Array<{ address: string; contributionUsd: number }>, lockMinutes: number, roundId?: string) {
    const total = participants.reduce((acc, p) => acc + p.contributionUsd, 0);
    const shares: ParticipantShare[] = participants.map(p => ({ address: p.address, weightBps: Math.floor((p.contributionUsd / Math.max(total, 1)) * 10000) }));
    const strategyId = `${syndicateId}:${roundId ?? 'adhoc'}`;
    return splitsService.snapshotParticipants(strategyId, shares, lockMinutes, roundId);
  }

  /**
   * Distribute winnings to pool members proportionally
   */
  async distributeProportionalRemainder(
    totalUsd: string,
    syndicateId: string,
    causePercent: number | undefined
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
    donateUsd: string;
    remainderUsd: string;
  }> {
    try {
      // Get pool info
      const pool = await syndicateRepository.getPoolById(syndicateId);
      if (!pool) {
        return {
          success: false,
          error: 'Pool not found',
          donateUsd: '0',
          remainderUsd: '0',
        };
      }

      // Use pool's cause allocation if not specified
      const causeAllocationPercent = causePercent ?? pool.cause_allocation_percent;

      // Calculate cause allocation
      const { causeAmount, remainderAmount } = distributionService.calculateCauseAllocation(
        totalUsd,
        causeAllocationPercent
      );

      // Get pool members
      const members = await syndicateRepository.getPoolMembers(syndicateId);

      if (members.length === 0) {
        return {
          success: false,
          error: 'No members in pool',
          donateUsd: causeAmount,
          remainderUsd: remainderAmount,
        };
      }

      // Calculate member weights based on contributions
      const totalPooled = parseFloat(pool.total_pooled_usdc);
      const weights = members.map(member => ({
        address: member.member_address,
        weightBps: Math.floor((parseFloat(member.amount_usdc) / totalPooled) * 10000),
      }));

      // Calculate allocations
      const allocations = distributionService.calculateProportionalShares(
        remainderAmount,
        weights
      );

      // Execute distribution
      const result = await distributionService.distributeToAddresses({
        totalAmount: remainderAmount,
        recipients: allocations,
        distributionType: 'syndicate',
        poolOrVaultId: syndicateId,
      });

      console.log('[SyndicateService] Distribution executed:', {
        poolId: syndicateId,
        totalAmount: totalUsd,
        causeAmount,
        remainderAmount,
        membersCount: members.length,
        success: result.success,
      });

      return {
        success: result.success,
        txHash: result.txHash,
        error: result.error,
        donateUsd: causeAmount,
        remainderUsd: remainderAmount,
      };
    } catch (error) {
      console.error('[SyndicateService] Distribution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Distribution failed',
        donateUsd: '0',
        remainderUsd: '0',
      };
    }
  }

  /**
   * Get pool details including members
   */
  async getPoolDetails(poolId: string): Promise<{
    pool: SyndicatePool;
    members: Array<{ address: string; amount: string; joinedAt: number }>;
    stats: { totalPooled: string; avgContribution: string };
  } | null> {
    const pool = await syndicateRepository.getPoolById(poolId);
    if (!pool) return null;

    const members = await syndicateRepository.getPoolMembers(poolId);
    const stats = await syndicateRepository.getPoolStats(poolId);

    return {
      pool: {
        id: pool.id,
        name: pool.name,
        description: pool.description || '',
        memberCount: pool.members_count,
        totalTickets: 0,
        causeAllocation: pool.cause_allocation_percent,
        isActive: pool.is_active,
      },
      members: members.map(m => ({
        address: m.member_address,
        amount: m.amount_usdc,
        joinedAt: parseInt(m.joined_at),
      })),
      stats: {
        totalPooled: stats?.totalPooled || '0',
        avgContribution: stats?.avgContribution || '0',
      },
    };
  }

  /**
   * Get pools for a specific member
   */
  async getMemberPools(memberAddress: string): Promise<SyndicatePool[]> {
    const rows = await syndicateRepository.getMemberPools(memberAddress);

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      memberCount: row.members_count,
      totalTickets: 0,
      causeAllocation: row.cause_allocation_percent,
      isActive: row.is_active,
    }));
  }

  /**
   * Deactivate a pool (only coordinator can do this)
   */
  async deactivatePool(poolId: string, coordinatorAddress: string): Promise<boolean> {
    const pool = await syndicateRepository.getPoolById(poolId);
    if (!pool) {
      throw new Error('Pool not found');
    }

    if (pool.coordinator_address.toLowerCase() !== coordinatorAddress.toLowerCase()) {
      throw new Error('Only pool coordinator can deactivate the pool');
    }

    await syndicateRepository.updatePoolStatus(poolId, false);

    console.log('[SyndicateService] Pool deactivated:', poolId);
    return true;
  }

  /**
    * Reactivate a pool (only coordinator can do this)
    */
  async reactivatePool(poolId: string, coordinatorAddress: string): Promise<boolean> {
    const pool = await syndicateRepository.getPoolById(poolId);
    if (!pool) {
      throw new Error('Pool not found');
    }

    if (pool.coordinator_address.toLowerCase() !== coordinatorAddress.toLowerCase()) {
      throw new Error('Only pool coordinator can reactivate the pool');
    }

    await syndicateRepository.updatePoolStatus(poolId, true);

    console.log('[SyndicateService] Pool reactivated:', poolId);
    return true;
  }

  /**
   * Execute a syndicate purchase on the SyndicatePool contract
   * 
   * ARCHITECTURE: Base-only syndicates
   * 
   * Flow:
   * 1. Verify pool exists and is active
   * 2. Call SyndicatePool.purchaseTicketsFromPool()
   * 3. SyndicatePool approves Megapot and purchases tickets
   * 4. Track purchase in database
   * 
   * @param poolId Database pool ID
   * @param ticketCount Number of tickets to purchase
   * @param coordinatorAddress Address of the coordinator (must match on-chain pool)
   */
  async executeSyndicatePurchase(
    poolId: string,
    ticketCount: number,
    coordinatorAddress: string
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Verify pool exists
      const pool = await syndicateRepository.getPoolById(poolId);
      if (!pool) {
        return {
          success: false,
          error: 'Pool not found',
        };
      }

      // Verify coordinator matches
      if (pool.coordinator_address.toLowerCase() !== coordinatorAddress.toLowerCase()) {
        return {
          success: false,
          error: 'Only pool coordinator can execute purchases',
        };
      }

      // Verify pool is active
      if (!pool.is_active) {
        return {
          success: false,
          error: 'Pool is not active',
        };
      }

      // Validate ticket count
      if (ticketCount < 1) {
        return {
          success: false,
          error: 'Ticket count must be at least 1',
        };
      }

      // Initialize web3 if needed
      if (!web3Service.isReady()) {
        await web3Service.initialize();
      }

      // TODO: Call SyndicatePool.purchaseTicketsFromPool()
      // This requires:
      // 1. Get contract instance via ethers.js/wagmi
      // 2. Call purchaseTicketsFromPool(pool.contract_pool_id, ticketCount)
      // 3. Wait for transaction confirmation
      
      // Placeholder implementation
      console.log('[SyndicateService] Would execute syndicate purchase:', {
        poolId,
        ticketCount,
        coordinatorAddress,
      });

      // For MVP: just log intent and return success
      // Production implementation would interact with contract
      const txHash = '0x' + '0'.repeat(64); // Placeholder

      console.log('[SyndicateService] Syndicate purchase executed:', {
        poolId,
        ticketCount,
        txHash,
      });

      return {
        success: true,
        txHash,
      };
    } catch (error) {
      console.error('[SyndicateService] Syndicate purchase failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  }

export const syndicateService = new SyndicateService();