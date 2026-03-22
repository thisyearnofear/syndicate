/**
 * Prize Distribution API
 * 
 * Handles prize distribution for syndicates:
 * - GET: Get distribution history for a pool
 * - POST: Trigger a prize distribution
 */

import { NextResponse } from 'next/server';
import { prizeDistributionService } from '@/services/prizes/prizeDistributionService';

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

    const history = await prizeDistributionService.getDistributionHistory(poolId!);
    return NextResponse.json({ distributions: history }, { headers: corsHeaders });
  } catch (error) {
    console.error('[PrizeDistribution API] GET error:', error);
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

    if (!poolId) {
      return NextResponse.json(
        { error: 'Missing poolId' },
        { status: 400, headers: corsHeaders }
      );
    }

    switch (action) {
      case 'distribute': {
        // Trigger a prize distribution
        if (!prizeAmount || prizeAmount <= 0) {
          return NextResponse.json(
            { error: 'Invalid prizeAmount' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Note: In production, the wallet client would be passed from an authenticated session
        // For demo purposes, we'll simulate the distribution
        
        const members = await prizeDistributionService.getPoolMembers(poolId);
        const memberShares = prizeDistributionService.calculateMemberShares(
          members, 
          prizeAmount
        );

        const distributionId = await prizeDistributionService.createDistributionRecord(
          poolId,
          prizeAmount,
          memberShares
        );

        return NextResponse.json({
          success: true,
          distributionId,
          message: 'Distribution created. In production, this would trigger the distribution flow.',
          memberShares,
          totalDistributed: prizeAmount,
        }, { headers: corsHeaders });
      }

      case 'record': {
        // Record an external distribution (e.g., triggered via Safe Wallet UI)
        if (!txHash) {
          return NextResponse.json(
            { error: 'Missing txHash' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Create a completed distribution record
        const members = await prizeDistributionService.getPoolMembers(poolId);
        const distributionId = await prizeDistributionService.createDistributionRecord(
          poolId,
          prizeAmount || 0,
          members.map(m => ({
            ...m,
            shareAmount: 0,
          }))
        );

        // Update to completed
        await prizeDistributionService.updateDistributionStatus(
          distributionId,
          'completed',
          txHash
        );

        return NextResponse.json({
          success: true,
          distributionId,
          message: 'Distribution recorded',
        }, { headers: corsHeaders });
      }

      case 'simulate': {
        // Simulate a distribution for demo purposes
        const members = await prizeDistributionService.getPoolMembers(poolId);
        const simulatedPrize = 1000; // $1000 prize
        const memberShares = prizeDistributionService.calculateMemberShares(
          members, 
          simulatedPrize
        );

        return NextResponse.json({
          success: true,
          simulated: true,
          prizeAmount: simulatedPrize,
          memberShares,
          totalDistributed: simulatedPrize,
          message: 'This is a simulation. Real distribution requires a wallet client.',
        }, { headers: corsHeaders });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (error) {
    console.error('[PrizeDistribution API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
