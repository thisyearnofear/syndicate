import { NextResponse } from 'next/server';
import { syndicateService } from '@/domains/syndicate/services/syndicateService';
import { syndicateRepository, type SyndicatePoolRow } from '@/lib/db/repositories/syndicateRepository';
import type { SyndicateInfo, SyndicateActivity } from '@/domains/lottery/types';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Map database row to SyndicateInfo interface
 * DRY: Single source of truth for data transformation
 */
function mapPoolToSyndicateInfo(pool: SyndicatePoolRow): SyndicateInfo {
  // Default cause data (in production, this would come from a causes table)
  const defaultCause = {
    id: `cause-${pool.id}`,
    name: 'Community Impact',
    verifiedWallet: pool.coordinator_address,
    description: pool.description || 'Community-driven impact pool',
    verificationSource: 'community' as const,
    verificationScore: 85,
    verificationTimestamp: new Date(pool.created_at),
    verificationTier: 2 as const,
  };

  // Calculate metrics from pool data
  const totalPooled = parseFloat(pool.total_pooled_usdc);
  const estimatedTicketPrice = 1.0; // $1 per ticket
  const ticketsPurchased = Math.floor(totalPooled / estimatedTicketPrice);

  return {
    id: pool.id,
    name: pool.name,
    model: 'altruistic', // Default model
    distributionModel: 'proportional',
    poolAddress: pool.coordinator_address, // Using coordinator as pool address for now
    executionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    cutoffDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    cause: defaultCause,
    description: pool.description || '',
    causePercentage: pool.cause_allocation_percent,
    governanceModel: 'leader', // Default governance
    governanceParameters: {
      maxFundAction: 10,
      actionTimeLimit: 24,
    },
    yieldToTicketsPercentage: 85,
    yieldToCausesPercentage: 15,
    vaultStrategy: 'aave', // Default vault strategy
    membersCount: pool.members_count,
    ticketsPooled: ticketsPurchased,
    ticketsPurchased: ticketsPurchased,
    totalImpact: totalPooled * 0.2, // 20% goes to cause
    isActive: pool.is_active,
    isTrending: pool.members_count > 1000, // Simple trending logic
    recentActivity: [], // Would be populated from activity tracking in production
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const syndicateId = url.searchParams.get('id');

    if (syndicateId) {
      // Get single syndicate by ID
      const pool = await syndicateRepository.getPoolById(syndicateId);
      if (!pool) {
        return NextResponse.json(
          { error: 'Syndicate not found' },
          { status: 404, headers: corsHeaders }
        );
      }
      const syndicate = mapPoolToSyndicateInfo(pool);
      return NextResponse.json(syndicate, { headers: corsHeaders });
    }

    // Get all active syndicates
    const pools = await syndicateRepository.getActivePools();
    const syndicates = pools.map(mapPoolToSyndicateInfo);
    
    return NextResponse.json(syndicates, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching syndicates:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch syndicates',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action;

    if (action === 'snapshot') {
      const syndicateId = body?.syndicateId as string;
      const participants = (body?.participants || []) as Array<{ address: string; contributionUsd: number }>;
      const lockMinutes = (body?.lockMinutes ?? 60) as number;
      const roundId = body?.roundId as string | undefined;
      const snapshot = syndicateService.snapshotProportionalWeights(syndicateId, participants, lockMinutes, roundId);
      return NextResponse.json(snapshot, { headers: corsHeaders });
    }

    if (action === 'create') {
      const { name, description, coordinatorAddress, causeAllocationPercent } = body;
      
      // Validation
      if (!name || !coordinatorAddress || causeAllocationPercent === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: name, coordinatorAddress, causeAllocationPercent' },
          { status: 400, headers: corsHeaders }
        );
      }

      const poolId = await syndicateRepository.createPool({
        name,
        description,
        coordinatorAddress,
        causeAllocationPercent
      });

      return NextResponse.json({ id: poolId, success: true }, { headers: corsHeaders });
    }

    if (action === 'join') {
      const { poolId, memberAddress, amountUsdc } = body;
      
      // Validation
      if (!poolId || !memberAddress || !amountUsdc) {
        return NextResponse.json(
          { error: 'Missing required fields: poolId, memberAddress, amountUsdc' },
          { status: 400, headers: corsHeaders }
        );
      }

      await syndicateRepository.addMember({
        poolId,
        memberAddress,
        amountUsdc
      });

      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (action === 'executePurchase') {
      const { poolId, ticketCount, coordinatorAddress } = body;
      
      // Validation
      if (!poolId || !ticketCount || !coordinatorAddress) {
        return NextResponse.json(
          { error: 'Missing required fields: poolId, ticketCount, coordinatorAddress' },
          { status: 400, headers: corsHeaders }
        );
      }

      const result = await syndicateService.executeSyndicatePurchase(
        poolId,
        ticketCount,
        coordinatorAddress
      );

      return NextResponse.json(result, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: 'Unsupported action. Supported: snapshot, create, join, executePurchase' },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error in POST /api/syndicates:', error);
    return NextResponse.json(
      { error: 'Invalid request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400, headers: corsHeaders }
    );
  }
}