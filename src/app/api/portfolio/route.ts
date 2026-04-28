/**
 * Portfolio API
 * 
 * Returns user's portfolio data across all syndicates:
 * - Total contributed
 * - Total winnings
 * - Total yield earned
 * - List of syndicates with individual stats
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user's syndicate memberships with pool info
    let memberships: any[] = [];
    try {
      const membershipsResult = await sql`
        SELECT
          m.pool_id,
          m.amount_usdc as contribution,
          m.joined_at,
          m.tx_hash,
          p.name as pool_name,
          p.description as pool_description,
          p.pool_type,
          p.vault_strategy,
          p.members_count,
          p.tickets_purchased as pool_tickets,
          p.cause_allocation_percent,
          p.cause_name,
          p.is_active,
          p.coordinator_address
        FROM syndicate_members m
        JOIN syndicate_pools p ON m.pool_id = p.id
        WHERE LOWER(m.member_address) = LOWER(${walletAddress})
        ORDER BY m.joined_at DESC
      `;
      memberships = membershipsResult.rows;
    } catch {
      // Tables may not exist yet (fresh database) - return empty portfolio
      console.warn('[Portfolio API] syndicate_members/pools tables not found, returning empty portfolio');
      return NextResponse.json({
        walletAddress,
        summary: {
          syndicateCount: 0,
          totalContributed: 0,
          totalWinnings: 0,
          totalYield: 0,
          totalPendingYield: 0,
          totalReturnValue: 0,
        },
        syndicates: [],
      }, { headers: corsHeaders });
    }

    // Calculate totals
    let totalContributed = 0;
    let totalWinnings = 0;
    let totalYield = 0;
    const syndicateCount = memberships.length;

    // Get winnings for each pool
    const syndicateDetails = await Promise.all(
      memberships.map(async (membership: any) => {
        const poolId = membership.pool_id;
        const contribution = parseFloat(membership.contribution || '0');
        totalContributed += contribution;

        // Get distribution winnings for this user
        let winnings = 0;
        try {
          const winningsResult = await sql`
            SELECT COALESCE(SUM(
              (d.prize_amount_usdc * m.amount_usdc / NULLIF(p.total_pooled_usdc, 0))
            ), 0) as winnings
            FROM prize_distributions d
            JOIN syndicate_members m ON m.pool_id = d.pool_id
            JOIN syndicate_pools p ON p.id = d.pool_id
            WHERE d.pool_id = ${poolId}
              AND LOWER(m.member_address) = LOWER(${walletAddress})
              AND d.status = 'completed'
          `;
          winnings = parseFloat(winningsResult.rows[0]?.winnings || '0');
        } catch (err) {
          console.error('Failed to fetch winnings:', err);
          // winnings remains 0
        }
        totalWinnings += winnings;

        // Get yield earned for this user
        let yieldEarned = 0;
        try {
          const yieldResult = await sql`
            SELECT COALESCE(SUM(yield_accrued_usdc), 0) as yield_earned
            FROM syndicate_vault_deposits
            WHERE pool_id = ${poolId}
              AND LOWER(member_address) = LOWER(${walletAddress})
          `;
          yieldEarned = parseFloat(yieldResult.rows[0]?.yield_earned || '0');
        } catch {
          // Table may not exist yet
        }
        totalYield += yieldEarned;

        // Calculate user's share percentage
        const totalPoolValue = parseFloat(membership.pool_tickets || '0') + contribution;
        const sharePercent = totalPoolValue > 0 ? (contribution / totalPoolValue) * 100 : 0;

        return {
          poolId,
          poolName: membership.pool_name,
          poolDescription: membership.pool_description,
          poolType: membership.pool_type || 'safe',
          vaultStrategy: membership.vault_strategy,
          causeName: membership.cause_name || 'Community Impact',
          causeAllocationPercent: membership.cause_allocation_percent,
          membersCount: membership.members_count,
          poolTickets: membership.pool_tickets || 0,
          isTrending: (membership.members_count || 0) > 1000,
          isActive: membership.is_active,
          // User-specific data
          contribution,
          winnings,
          yieldEarned,
          sharePercent,
          joinedAt: membership.joined_at,
          txHash: membership.tx_hash,
        };
      })
    );

    // Get pending yield across all pools
    let totalPendingYield = 0;
    try {
      const pendingResult = await sql`
        SELECT COALESCE(SUM(
          COALESCE(d.yield_accrued_usdc, 0) - COALESCE(c.converted, 0)
        ), 0) as pending
        FROM syndicate_vault_deposits d
        LEFT JOIN (
          SELECT pool_id, SUM(yield_amount_usdc) as converted
          FROM yield_conversions
          GROUP BY pool_id
        ) c ON c.pool_id = d.pool_id
        WHERE LOWER(d.member_address) = LOWER(${walletAddress})
      `;
      totalPendingYield = parseFloat(pendingResult.rows[0]?.pending || '0');
    } catch {
      // Table may not exist yet
    }

    return NextResponse.json({
      walletAddress,
      summary: {
        syndicateCount,
        totalContributed,
        totalWinnings,
        totalYield,
        totalPendingYield,
        totalReturnValue: totalContributed + totalWinnings + totalYield,
      },
      syndicates: syndicateDetails,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Portfolio API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
