/**
 * Transaction History API
 * 
 * Returns transaction history for a syndicate pool.
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { transactionHistoryService } from '@/services/transactions/transactionHistoryService';
import type { Address } from 'viem';

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
    const poolId = searchParams.get('poolId');
    const type = searchParams.get('type'); // Filter by type
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!poolId) {
      return NextResponse.json(
        { error: 'Missing poolId' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get pool info to determine pool address and type
    const poolResult = await sql`
      SELECT pool_type, safe_address, split_address, pt_vault_address, coordinator_address
      FROM syndicate_pools
      WHERE id = ${poolId}
    `;

    if (poolResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const pool = poolResult.rows[0];
    const poolType = (pool.pool_type || 'safe') as string;
    const poolAddress = (
      poolType === 'splits' && pool.split_address
        ? pool.split_address
        : poolType === 'pooltogether' && pool.pt_vault_address
        ? pool.pt_vault_address
        : pool.safe_address || pool.coordinator_address
    ) as Address;

    // Get member deposits from database
    const membersResult = await sql`
      SELECT address, contribution_usdc, joined_at, tx_hash
      FROM syndicate_members
      WHERE pool_id = ${poolId}
      ORDER BY joined_at DESC
      LIMIT ${limit}
    `;

    // Get distributions from database
    const distributionsResult = await sql`
      SELECT id, prize_amount_usdc, status, tx_hash, created_at, completed_at
      FROM prize_distributions
      WHERE pool_id = ${poolId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    // Combine and format transactions
    const transactions: Array<{
      hash: string;
      type: string;
      typeLabel: string;
      typeColor: string;
      from: string;
      to: string | null;
      amount: string;
      amountFormatted: string;
      timestamp: string;
      status: string;
      explorerUrl: string;
      summary: string;
    }> = [];

    // Add member deposits
    for (const member of membersResult.rows) {
      transactions.push({
        hash: member.tx_hash || `deposit-${member.address}`,
        type: 'deposit',
        typeLabel: 'Deposit',
        typeColor: 'text-green-400',
        from: member.address,
        to: poolAddress,
        amount: member.contribution_usdc,
        amountFormatted: `$${parseFloat(member.contribution_usdc).toFixed(2)} USDC`,
        timestamp: new Date(member.joined_at).toISOString(),
        status: member.tx_hash ? 'confirmed' : 'recorded',
        explorerUrl: member.tx_hash 
          ? transactionHistoryService.getExplorerUrl(member.tx_hash)
          : '',
        summary: `Deposit by ${member.address.slice(0, 6)}…`,
      });
    }

    // Add distributions
    for (const dist of distributionsResult.rows) {
      transactions.push({
        hash: dist.tx_hash || `dist-${dist.id}`,
        type: 'distribution',
        typeLabel: 'Distribution',
        typeColor: 'text-purple-400',
        from: poolAddress,
        to: null,
        amount: dist.prize_amount_usdc,
        amountFormatted: `$${parseFloat(dist.prize_amount_usdc).toFixed(2)} USDC`,
        timestamp: new Date(dist.created_at).toISOString(),
        status: dist.status === 'completed' ? 'confirmed' : dist.status,
        explorerUrl: dist.tx_hash 
          ? transactionHistoryService.getExplorerUrl(dist.tx_hash)
          : '',
        summary: `Prize distribution to members`,
      });
    }

    // Sort by timestamp (newest first)
    transactions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply type filter
    const filtered = type 
      ? transactions.filter(t => t.type === type)
      : transactions;

    // Get pool summary
    const totalDeposits = membersResult.rows.reduce(
      (sum, m) => sum + parseFloat(m.contribution_usdc || '0'), 
      0
    );
    const totalDistributions = distributionsResult.rows.reduce(
      (sum, d) => sum + parseFloat(d.prize_amount_usdc || '0'), 
      0
    );

    return NextResponse.json({
      poolId,
      poolType,
      poolAddress,
      transactions: filtered.slice(0, limit),
      summary: {
        totalDeposits: totalDeposits.toFixed(2),
        totalDistributions: totalDistributions.toFixed(2),
        memberCount: membersResult.rows.length,
        distributionCount: distributionsResult.rows.length,
      },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[TransactionHistory API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
