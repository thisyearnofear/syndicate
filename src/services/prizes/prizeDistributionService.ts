/**
 * PRIZE DISTRIBUTION SERVICE (RECORD-KEEPING)
 *
 * Journals externally-executed prize distributions for syndicate pools and
 * computes member shares, read-side. It deliberately does NOT move money:
 *
 * - Winnings are claimed from Megapot by the pool coordinator via the solo
 *   claim path (withdrawWinnings) — tickets bought by a syndicate credit
 *   the coordinator's address (see syndicateService.executeSyndicatePurchase).
 * - Payouts to members execute through the pool's own rail (Safe app
 *   proposal, wallet-signed splitsService.distributeToken, Cabana claims).
 * - This service records a distribution ONLY after API-side on-chain
 *   verification of the payout transaction (see /api/syndicates/prizes).
 *
 * The previous in-app execution router (distributePrize/distributeVia*)
 * was removed: it was dead code, and its Safe path returned pretend
 * success without a transaction. Real execution lives in
 * splitsService.distributeToken and safeService/safeProvider, which fail
 * honestly when they cannot execute.
 */

import { sql } from '@vercel/postgres';
import type { PoolType } from '@/domains/lottery/types';
import type { Address } from 'viem';

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
    // Column names must match the syndicate_members schema
    // (lib/db/migrations/002-syndicate-vault-schema.sql).
    const result = await sql`
      SELECT member_address, amount_usdc
      FROM syndicate_members
      WHERE pool_id = ${poolId}
      ORDER BY amount_usdc DESC
    `;

    const members = result.rows as unknown as Array<{ member_address: string; amount_usdc: string }>;
    const totalContributed = members.reduce(
      (sum, m) => sum + parseFloat(m.amount_usdc || '0'),
      0
    );

    return members.map(m => {
      const contribution = parseFloat(m.amount_usdc || '0');
      const contributionPercent = totalContributed > 0
        ? (contribution / totalContributed) * 100
        : 0;

      return {
        address: m.member_address as Address,
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
    coordinatorAddress: Address;
    memberCount: number;
  } | null> {
    const result = await sql`
      SELECT pool_type, safe_address, split_address, pt_vault_address, coordinator_address, member_count
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
      coordinatorAddress: pool.coordinator_address as Address,
      memberCount: parseInt(pool.member_count ?? '0', 10) || 0,
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
   * True if a distribution with this tx hash is already journaled for the pool.
   * Guards the record endpoint against double-journaling the same payout.
   */
  async hasDistributionWithTxHash(poolId: string, txHash: string): Promise<boolean> {
    const result = await sql`
      SELECT 1 AS one
      FROM prize_distributions
      WHERE pool_id = ${poolId} AND tx_hash = ${txHash}
      LIMIT 1
    `;
    return result.rows.length > 0;
  }

  /**
   * Get distribution history for a pool.
   * Member shares are recomputed from current contribution weights
   * (same proportional semantics as /api/portfolio) since the schema
   * does not store a per-member payout snapshot.
   */
  async getDistributionHistory(poolId: string): Promise<PrizeDistribution[]> {
    const result = await sql`
      SELECT
        d.id, d.pool_id, d.prize_amount_usdc, d.member_count,
        d.status, d.tx_hash, d.created_at, d.completed_at, d.error,
        p.pool_type
      FROM prize_distributions d
      LEFT JOIN syndicate_pools p ON p.id = d.pool_id
      WHERE d.pool_id = ${poolId}
      ORDER BY d.created_at DESC
      LIMIT 50
    `;

    if (result.rows.length === 0) return [];

    const members = await this.getPoolMembers(poolId);
    const totalContributed = members.reduce((sum, m) => sum + m.contribution, 0);

    return result.rows.map((row) => ({
      id: row.id,
      poolId: row.pool_id,
      poolType: (row.pool_type || 'safe') as PoolType,
      status: row.status as DistributionStatus,
      prizeAmount: parseFloat(row.prize_amount_usdc),
      totalContributed,
      memberShares: this.calculateMemberShares(members, parseFloat(row.prize_amount_usdc)),
      txHash: row.tx_hash,
      createdAt: new Date(Number(row.created_at)),
      completedAt: row.completed_at ? new Date(Number(row.completed_at)) : null,
      error: row.error,
    }));
  }

  /**
   * Get a specific distribution by ID
   */
  async getDistribution(distributionId: string): Promise<PrizeDistribution | null> {
    const result = await sql`
      SELECT
        d.id, d.pool_id, d.prize_amount_usdc, d.member_count,
        d.status, d.tx_hash, d.created_at, d.completed_at, d.error,
        p.pool_type
      FROM prize_distributions d
      LEFT JOIN syndicate_pools p ON p.id = d.pool_id
      WHERE d.id = ${distributionId}
    `;

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const members = await this.getPoolMembers(row.pool_id);
    const prizeAmount = parseFloat(row.prize_amount_usdc);

    return {
      id: row.id,
      poolId: row.pool_id,
      poolType: (row.pool_type || 'safe') as PoolType,
      status: row.status as DistributionStatus,
      prizeAmount,
      totalContributed: members.reduce((sum, m) => sum + m.contribution, 0),
      memberShares: this.calculateMemberShares(members, prizeAmount),
      txHash: row.tx_hash,
      createdAt: new Date(Number(row.created_at)),
      completedAt: row.completed_at ? new Date(Number(row.completed_at)) : null,
      error: row.error,
    };
  }
}

export const prizeDistributionService = new PrizeDistributionService();
