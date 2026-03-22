/**
 * SYNDICATE REPOSITORY
 * Database operations for syndicate pools and members
 * 
 * Core Principles Applied:
 * - CLEAN: Separation of database logic from business logic
 * - DRY: Single source of truth for syndicate data access
 */

import { sql } from '@vercel/postgres';

export interface SyndicatePoolRow {
    id: string;
    name: string;
    description: string | null;
    coordinator_address: string;
    lottery_id: string | null;
    members_count: number;
    total_pooled_usdc: string;
    tickets_purchased: number;
    total_impact_usdc: string;
    cause_allocation_percent: number;
    privacy_enabled: boolean;
    pool_public_key: Buffer | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SyndicateMemberRow {
    id: string;
    pool_id: string;
    member_address: string;
    amount_usdc: string;
    amount_commitment: Buffer | null;
    tx_hash: string | null;
    joined_at: string;
    updated_at: string;
}

export class SyndicateRepository {
    /**
     * Create a new syndicate pool
     */
    async createPool(params: {
        name: string;
        description?: string;
        coordinatorAddress: string;
        causeAllocationPercent: number;
        lotteryId?: string;
    }): Promise<string> {
        const now = Date.now();

        const result = await sql`
      INSERT INTO syndicate_pools (
        name,
        description,
        coordinator_address,
        lottery_id,
        cause_allocation_percent,
        created_at,
        updated_at
      ) VALUES (
        ${params.name},
        ${params.description || null},
        ${params.coordinatorAddress},
        ${params.lotteryId ?? null},
        ${params.causeAllocationPercent},
        ${now},
        ${now}
      )
      RETURNING id
    `;

        return result.rows[0].id;
    }

    /**
     * Get pool by ID
     */
    async getPoolById(poolId: string): Promise<SyndicatePoolRow | null> {
        const result = await sql`
      SELECT * FROM syndicate_pools
      WHERE id = ${poolId}
    `;

        return (result.rows[0] as SyndicatePoolRow) || null;
    }

    /**
     * Get all active pools
     */
    async getActivePools(): Promise<SyndicatePoolRow[]> {
        const result = await sql`
      SELECT * FROM syndicate_pools
      WHERE is_active = true
      ORDER BY created_at DESC
    `;

        return result.rows as SyndicatePoolRow[];
    }

    /**
     * Get pools by coordinator
     */
    async getPoolsByCoordinator(coordinatorAddress: string): Promise<SyndicatePoolRow[]> {
        const result = await sql`
      SELECT * FROM syndicate_pools
      WHERE coordinator_address = ${coordinatorAddress}
      ORDER BY created_at DESC
    `;

        return result.rows as SyndicatePoolRow[];
    }

    /**
     * Add member to pool or update existing contribution
     */
    async addMember(params: {
        poolId: string;
        memberAddress: string;
        amountUsdc: string;
        txHash?: string;
    }): Promise<string> {
        const now = Date.now();

        // Insert or update member
        const result = await sql`
      INSERT INTO syndicate_members (
        pool_id,
        member_address,
        amount_usdc,
        tx_hash,
        joined_at,
        updated_at
      ) VALUES (
        ${params.poolId},
        ${params.memberAddress},
        ${params.amountUsdc},
        ${params.txHash ?? null},
        ${now},
        ${now}
      )
      ON CONFLICT (pool_id, member_address)
      DO UPDATE SET
        amount_usdc = syndicate_members.amount_usdc + EXCLUDED.amount_usdc,
        tx_hash = EXCLUDED.tx_hash,
        updated_at = EXCLUDED.updated_at
      RETURNING id
    `;

        // Update pool totals
        await sql`
      UPDATE syndicate_pools
      SET
        total_pooled_usdc = (
          SELECT COALESCE(SUM(amount_usdc), 0)
          FROM syndicate_members
          WHERE pool_id = ${params.poolId}
        ),
        members_count = (
          SELECT COUNT(DISTINCT member_address)
          FROM syndicate_members
          WHERE pool_id = ${params.poolId}
        ),
        updated_at = ${now}
      WHERE id = ${params.poolId}
    `;

        return result.rows[0].id;
    }

    /**
     * Get pool members with their contributions
     */
    async getPoolMembers(poolId: string): Promise<SyndicateMemberRow[]> {
        const result = await sql`
      SELECT * FROM syndicate_members
      WHERE pool_id = ${poolId}
      ORDER BY joined_at ASC
    `;

        return result.rows as SyndicateMemberRow[];
    }

    /**
     * Get member's contribution to a pool
     */
    async getMemberContribution(
        poolId: string,
        memberAddress: string
    ): Promise<string | null> {
        const result = await sql`
      SELECT amount_usdc FROM syndicate_members
      WHERE pool_id = ${poolId}
        AND member_address = ${memberAddress}
    `;

        return result.rows[0]?.amount_usdc || null;
    }

    /**
     * Get all pools a member has joined
     */
    async getMemberPools(memberAddress: string): Promise<SyndicatePoolRow[]> {
        const result = await sql`
      SELECT p.* FROM syndicate_pools p
      INNER JOIN syndicate_members m ON p.id = m.pool_id
      WHERE m.member_address = ${memberAddress}
      ORDER BY m.joined_at DESC
    `;

        return result.rows as SyndicatePoolRow[];
    }

    /**
     * Update pool status
     */
    async updatePoolStatus(poolId: string, isActive: boolean): Promise<void> {
        await sql`
      UPDATE syndicate_pools
      SET is_active = ${isActive}, updated_at = ${Date.now()}
      WHERE id = ${poolId}
    `;
    }

    /**
     * Get pool statistics
     */
    async getPoolStats(poolId: string): Promise<{
        totalPooled: string;
        membersCount: number;
        avgContribution: string;
        ticketsPurchased: number;
        totalImpact: string;
    } | null> {
        const result = await sql`
      SELECT 
        COALESCE(SUM(amount_usdc), 0) as total_pooled,
        COUNT(DISTINCT member_address) as members_count,
        COALESCE(AVG(amount_usdc), 0) as avg_contribution,
        tickets_purchased,
        total_impact_usdc
      FROM syndicate_pools p
      LEFT JOIN syndicate_members m ON p.id = m.pool_id
      WHERE p.id = ${poolId}
      GROUP BY p.id, p.tickets_purchased, p.total_impact_usdc
    `;

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            totalPooled: row.total_pooled,
            membersCount: parseInt(row.members_count),
            avgContribution: row.avg_contribution,
            ticketsPurchased: parseInt(row.tickets_purchased || '0'),
            totalImpact: row.total_impact_usdc || '0',
        };
    }

    /**
     * Record ticket purchase for a pool
     */
    async recordTicketPurchase(poolId: string, ticketCount: number, txHash?: string): Promise<void> {
        const now = Date.now();
        
        // Update pool ticket count
        await sql`
      UPDATE syndicate_pools
      SET 
        tickets_purchased = tickets_purchased + ${ticketCount},
        updated_at = ${now}
      WHERE id = ${poolId}
    `;

        // If transaction hash provided, we could store it in distributions table
        // For now, just update the pool totals
    }

    /**
     * Update pool impact (total USDC allocated to causes)
     */
    async updatePoolImpact(poolId: string, impactAmountUsdc: string): Promise<void> {
        await sql`
      UPDATE syndicate_pools
      SET 
        total_impact_usdc = ${impactAmountUsdc},
        updated_at = ${Date.now()}
      WHERE id = ${poolId}
    `;
    }
}

export const syndicateRepository = new SyndicateRepository();
