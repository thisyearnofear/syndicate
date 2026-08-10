/**
 * Prize Distribution API
 *
 * Honesty contract:
 * - This route never executes or pretends to execute money movement.
 * - GET returns journal history plus pool metadata the UI needs for the
 *   coordinator's payout flow.
 * - POST { action: 'record' } journals an externally-executed payout ONLY
 *   after verifying the transaction receipt on Base: it must exist, have
 *   succeeded, and have been initiated by the pool coordinator.
 * - The former 'distribute' and 'simulate' actions were removed — they
 *   created records for money that never moved.
 */

import { NextResponse } from 'next/server';
import { prizeDistributionService } from '@/services/prizes/prizeDistributionService';
import { logger } from '@/lib/logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const distributionId = searchParams.get('distributionId');

    if (!poolId && !distributionId) {
      return NextResponse.json(
        { error: 'Missing poolId or distributionId' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (distributionId) {
      const distribution = await prizeDistributionService.getDistribution(distributionId);
      if (!distribution) {
        return NextResponse.json(
          { error: 'Distribution not found' },
          { status: 404, headers: corsHeaders }
        );
      }
      return NextResponse.json(distribution, { headers: corsHeaders });
    }

    const [history, pool] = await Promise.all([
      prizeDistributionService.getDistributionHistory(poolId!),
      prizeDistributionService.getPoolInfo(poolId!),
    ]);

    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Member weights are needed for share estimates. Fhenix pools keep the
    // member list gated (consistent with /api/syndicates/dashboard), so we
    // omit weights there; share estimates simply won't render.
    const members =
      pool.poolType === 'fhenix' ? [] : await prizeDistributionService.getPoolMembers(poolId!);

    return NextResponse.json({ distributions: history, pool, members }, { headers: corsHeaders });
  } catch (error) {
    logger.error('[PrizeDistribution API] GET error', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, poolId, prizeAmount, txHash } = body;

    if (action !== 'record') {
      return NextResponse.json(
        { error: `Unknown action: ${action}. Only 'record' is supported — payouts execute on-chain via the pool's own rail (Safe app, 0xSplits, or Cabana).` },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!poolId || typeof prizeAmount !== 'number' || !(prizeAmount > 0) || !txHash) {
      return NextResponse.json(
        { error: 'Missing or invalid poolId, prizeAmount, or txHash' },
        { status: 400, headers: corsHeaders }
      );
    }

    const pool = await prizeDistributionService.getPoolInfo(poolId);
    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (await prizeDistributionService.hasDistributionWithTxHash(poolId, txHash)) {
      return NextResponse.json(
        { error: 'This transaction is already journaled for this pool' },
        { status: 409, headers: corsHeaders }
      );
    }

    // Verify the payout receipt on Base before journaling anything.
    // Mirror of the join-verification pattern in /api/syndicates.
    const { createPublicClient, http, isHash } = await import('viem');
    const { base } = await import('viem/chains');

    if (!isHash(txHash)) {
      return NextResponse.json(
        { error: 'Invalid transaction hash format' },
        { status: 400, headers: corsHeaders }
      );
    }

    const client = createPublicClient({
      chain: base,
      transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
    });

    let receipt;
    try {
      receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    } catch {
      return NextResponse.json(
        { error: 'Transaction not found on Base yet — it may still be pending. Retry once it confirms.' },
        { status: 422, headers: corsHeaders }
      );
    }

    if (receipt.status !== 'success') {
      return NextResponse.json(
        { error: 'Transaction reverted on-chain — nothing was paid out' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (receipt.from?.toLowerCase() !== pool.coordinatorAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Payout transaction must be initiated by the pool coordinator' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Journal only now, with realistic member shares computed from
    // current contribution weights.
    const members = await prizeDistributionService.getPoolMembers(poolId);
    const memberShares = prizeDistributionService.calculateMemberShares(members, prizeAmount);
    const distributionId = await prizeDistributionService.createDistributionRecord(
      poolId,
      prizeAmount,
      memberShares,
    );
    await prizeDistributionService.updateDistributionStatus(distributionId, 'completed', txHash);

    return NextResponse.json({
      success: true,
      distributionId,
      message: 'Payout verified on-chain and journaled',
    }, { headers: corsHeaders });
  } catch (error) {
    logger.error('[PrizeDistribution API] POST error', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
