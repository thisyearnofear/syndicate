/**
 * Syndicate Dashboard API
 * 
 * Returns comprehensive dashboard data for a syndicate including:
 * - Pool balance (from on-chain)
 * - Member list with contributions
 * - Recent activity
 * - Prize distribution status
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { safeService } from '@/services/safe/safeService';
import { splitsService } from '@/services/splits/splitService';
import { poolTogetherVaultService } from '@/services/poolTogether/vaultService';
import type { PoolType } from '@/domains/lottery/types';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

interface DashboardMember {
  address: string;
  contribution_usdc: string;
  joined_at: string;
  tx_hash: string | null;
}

interface DashboardActivity {
  id: string;
  type: 'join' | 'deposit' | 'distribution' | 'ticket_purchase' | 'win';
  amount_usdc: string | null;
  member_address: string | null;
  tx_hash: string | null;
  created_at: string;
}

interface SyndicateDashboardData {
  // Basic info
  id: string;
  name: string;
  pool_type: PoolType;
  
  // Pool addresses
  pool_address: string;
  safe_address: string | null;
  split_address: string | null;
  pt_vault_address: string | null;
  
  // Balances (on-chain)
  pool_balance_usdc: string;
  pool_balance_formatted: string;
  
  // Members
  members_count: number;
  members: DashboardMember[];
  total_contributed_usdc: string;
  
  // Tickets
  tickets_purchased: number;
  tickets_per_member: number;
  
  // Impact
  total_impact_usdc: string;
  cause_percentage: number;
  
  // Activity
  recent_activity: DashboardActivity[];
  
  // Pool-specific info
  safe_info?: {
    owners: string[];
    threshold: number;
    nonce: number;
  };
  split_info?: {
    recipients: Array<{ address: string; share_percent: number }>;
  };
  pt_vault_info?: {
    name: string;
    symbol: string;
    total_assets: string;
    apy: number;
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('id');

    if (!poolId) {
      return NextResponse.json(
        { error: 'Missing pool ID' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch pool data from database
    const poolResult = await sql`
      SELECT 
        id, name, pool_type, coordinator_address,
        safe_address, split_address, pt_vault_address,
        members_count, tickets_purchased, total_impact_usdc,
        cause_allocation_percent
      FROM syndicate_pools 
      WHERE id = ${poolId}
    `;

    if (poolResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Syndicate not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const pool = poolResult.rows[0];
    const poolType = (pool.pool_type || 'safe') as PoolType;

    // Determine pool address based on type
    const poolAddress = poolType === 'splits' && pool.split_address
      ? pool.split_address
      : poolType === 'pooltogether' && pool.pt_vault_address
      ? pool.pt_vault_address
      : pool.safe_address || pool.coordinator_address;

    // Fetch on-chain balance based on pool type
    let poolBalance = '0';
    let poolBalanceFormatted = '$0.00';
    
    try {
      switch (poolType) {
        case 'safe':
          poolBalance = await safeService.getSafeBalance(poolAddress);
          break;
        case 'splits':
          // Splits don't hold balances - they distribute
          poolBalance = '0';
          break;
        case 'pooltogether':
          const vaultInfo = await poolTogetherVaultService.fetchVaultInfo(poolAddress);
          poolBalance = vaultInfo?.totalAssets || '0';
          poolBalanceFormatted = `$${parseFloat(vaultInfo?.totalAssetsFormatted || '0').toLocaleString()}`;
          break;
      }
      
      if (poolType !== 'pooltogether') {
        poolBalanceFormatted = `$${parseFloat(poolBalance).toLocaleString()}`;
      }
    } catch (error) {
      console.error('[Dashboard API] Failed to fetch on-chain balance:', error);
    }

    // Fetch members
    const membersResult = await sql`
      SELECT address, contribution_usdc, joined_at, tx_hash
      FROM syndicate_members 
      WHERE pool_id = ${poolId}
      ORDER BY contribution_usdc DESC
    `;
    const members: DashboardMember[] = membersResult.rows as unknown as DashboardMember[];

    // Calculate total contributed
    const totalContributed = members.reduce((sum, m) => sum + parseFloat(m.contribution_usdc || '0'), 0);

    // Fetch recent activity (simplified - would need activity table in production)
    const recentActivity: DashboardActivity[] = members.slice(0, 10).map((m, i) => ({
      id: `activity-${i}`,
      type: 'join' as const,
      amount_usdc: m.contribution_usdc,
      member_address: m.address,
      tx_hash: m.tx_hash,
      created_at: m.joined_at,
    }));

    // Fetch pool-specific info
    let safeInfo, splitInfo, ptVaultInfo;
    
    try {
      switch (poolType) {
        case 'safe':
          const safeData = await safeService.getSafeInfo(poolAddress);
          if (safeData) {
            safeInfo = {
              owners: safeData.owners,
              threshold: safeData.threshold,
              nonce: safeData.nonce,
            };
          }
          break;
        case 'splits':
          const splitData = await splitsService.getSplitInfo(poolAddress);
          if (splitData) {
            splitInfo = {
              recipients: splitData.recipients.map(r => ({
                address: r.address,
                share_percent: r.percentAllocation,
              })),
            };
          }
          break;
        case 'pooltogether':
          const ptData = await poolTogetherVaultService.fetchVaultInfo(poolAddress);
          const ptStats = await poolTogetherVaultService.fetchVaultStats(poolAddress);
          if (ptData) {
            ptVaultInfo = {
              name: ptData.name,
              symbol: ptData.symbol,
              total_assets: ptData.totalAssetsFormatted,
              apy: ptStats?.apy || 3.5,
            };
          }
          break;
      }
    } catch (error) {
      console.error('[Dashboard API] Failed to fetch pool-specific info:', error);
    }

    const ticketsPerMember = pool.tickets_purchased / Math.max(members.length, 1);

    const dashboardData: SyndicateDashboardData = {
      id: pool.id,
      name: pool.name,
      pool_type: poolType,
      pool_address: poolAddress,
      safe_address: pool.safe_address,
      split_address: pool.split_address,
      pt_vault_address: pool.pt_vault_address,
      pool_balance_usdc: poolBalance,
      pool_balance_formatted: poolBalanceFormatted,
      members_count: members.length,
      members,
      total_contributed_usdc: totalContributed.toFixed(2),
      tickets_purchased: pool.tickets_purchased || 0,
      tickets_per_member: ticketsPerMember,
      total_impact_usdc: pool.total_impact_usdc || '0',
      cause_percentage: pool.cause_allocation_percent || 15,
      recent_activity: recentActivity,
      safe_info: safeInfo,
      split_info: splitInfo,
      pt_vault_info: ptVaultInfo,
    };

    return NextResponse.json(dashboardData, { headers: corsHeaders });
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
