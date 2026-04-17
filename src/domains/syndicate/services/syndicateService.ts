/**
 * SYNDICATE SERVICE
 * 
 * Core Principles Applied:
 * - MODULAR: Isolated syndicate logic
 * - CLEAN: Clear service interface
 * - ENHANCEMENT FIRST: Building on existing stubs
 */

import type { SyndicatePool } from '../types';
import { web3Service } from '@/services/web3Service';
import { splitsService, type ParticipantShare } from '@/services/splitsService';
import { distributionService } from '@/services/distributionService';
import { syndicateRepository, type PoolType } from '@/lib/db/repositories/syndicateRepository';
import { safeProvider, splitsProvider, poolTogetherV5Provider } from '@/services/syndicate/poolProviders';
import type { PoolProvider, PoolProviderConfig, PoolCreationResult } from '@/services/syndicate/poolProviders';
import { isAddress } from 'viem';

export class SyndicateService {
  /**
   * Get pool provider for a given pool type
   */
  private getPoolProvider(poolType: PoolType): PoolProvider {
    switch (poolType) {
      case 'safe':
        return safeProvider;
      case 'splits':
        return splitsProvider;
      case 'pooltogether':
        return poolTogetherV5Provider;
      default:
        return safeProvider;
    }
  }

  /**
   * Create a new syndicate pool
   */
  async createPool(params: {
    name: string;
    description?: string;
    coordinatorAddress: string;
    causeAllocationPercent: number;
    poolType?: PoolType;
    members?: Array<{ address: string; sharePercent: number }>;
  }): Promise<string> {
    // Validate cause allocation
    if (params.causeAllocationPercent < 0 || params.causeAllocationPercent > 100) {
      throw new Error('Cause allocation must be between 0 and 100');
    }

    // Validate coordinator address
    if (!isAddress(params.coordinatorAddress)) {
      throw new Error('Invalid coordinator address');
    }

    const poolType = params.poolType || 'safe';

    // Create on-chain pool using the appropriate provider
    let poolAddress: string | undefined;
    let splitAddress: string | undefined;
    let ptVaultAddress: string | undefined;
    
    try {
      const provider = this.getPoolProvider(poolType);
      const poolConfig: PoolProviderConfig = {
        poolType,
        chainId: 8453, // Base
        members: params.members || [],
        coordinatorAddress: params.coordinatorAddress,
        threshold: poolType === 'safe' ? Math.max(1, Math.floor((params.members?.length || 1) / 2) + 1) : undefined,
      };

      const result: PoolCreationResult = await provider.createPool(poolConfig);
      
      if (result.success) {
        poolAddress = result.poolAddress;
        
        // Store type-specific addresses
        if (poolType === 'splits') {
          splitAddress = result.poolAddress;
        } else if (poolType === 'pooltogether') {
          ptVaultAddress = result.poolAddress;
        }
        
        console.log('[SyndicateService] On-chain pool created:', {
          poolType,
          poolAddress,
          metadata: result.metadata,
        });
      } else {
        console.warn('[SyndicateService] Failed to create on-chain pool:', result.error);
        // Continue with database-only pool (graceful degradation)
      }
    } catch (error) {
      console.warn('[SyndicateService] Pool provider error, continuing with DB-only:', error);
    }

    // Create pool in database
    const poolId = await syndicateRepository.createPool({
      name: params.name,
      description: params.description,
      coordinatorAddress: params.coordinatorAddress,
      causeAllocationPercent: params.causeAllocationPercent,
      poolType,
      safeAddress: poolType === 'safe' ? poolAddress : undefined,
      splitAddress,
      ptVaultAddress,
      memberShares: params.members,
    });

    console.log('[SyndicateService] Pool created:', {
      poolId,
      name: params.name,
      coordinator: params.coordinatorAddress,
      poolType,
      poolAddress,
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
    if (!isAddress(params.memberAddress)) {
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

    return rows.map(row => {
      // Calculate tickets from total pooled (ticket price is $1)
      const totalPooled = parseFloat(row.total_pooled_usdc);
      const estimatedTicketPrice = 1.0;
      const totalTickets = Math.floor(totalPooled / estimatedTicketPrice);
      
      return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        memberCount: row.members_count,
        totalTickets: totalTickets, // Calculate from total pooled
        causeAllocation: row.cause_allocation_percent,
        isActive: row.is_active,
      };
    });
  }

  /**
   * Prepare an ad-hoc batch purchase for a syndicate
   * Uses the repository directly instead of fetching from the API (no circular dep)
   */
  async prepareAdHocBatchPurchase(syndicateId: string, ticketCount: number): Promise<{ success: boolean; txHash?: string; error?: string; recipient?: string }> {
    const pool = await syndicateRepository.getPoolById(syndicateId);
    if (!pool) return { success: false, error: 'Pool not found' };

    // Determine pool address from pool type
    const poolAddress = pool.pool_type === 'splits' && pool.split_address
      ? pool.split_address
      : pool.pool_type === 'pooltogether' && pool.pt_vault_address
      ? pool.pt_vault_address
      : pool.safe_address || pool.coordinator_address;

    if (!poolAddress) return { success: false, error: 'Pool address unavailable' };
    const result = await web3Service.purchaseTickets(ticketCount, poolAddress);
    return { success: result.success, txHash: result.txHash, error: result.error, recipient: poolAddress };
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

      console.log('[SyndicateService] Executing syndicate purchase:', {
        poolId,
        ticketCount,
        coordinatorAddress,
        poolAddress: pool.coordinator_address,
      });

      // Use the pool's coordinator address as recipient for tickets
      // In a real implementation, this would call SyndicatePool.purchaseTicketsFromPool()
      // For now, we purchase tickets to the pool coordinator's address
      const result = await web3Service.purchaseTickets(
        ticketCount,
        pool.coordinator_address
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to purchase tickets',
        };
      }

      console.log('[SyndicateService] Syndicate purchase executed:', {
        poolId,
        ticketCount,
        txHash: result.txHash,
      });

      return {
        success: true,
        txHash: result.txHash,
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