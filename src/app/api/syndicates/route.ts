import { NextResponse } from 'next/server';
import { isHex, parseUnits } from 'viem';
import { basePublicClient } from '@/lib/baseClient';
import { syndicateService } from '@/domains/syndicate/services/syndicateService';
import { syndicateRepository, type SyndicatePoolRow } from '@/lib/db/repositories/syndicateRepository';
import type { SyndicateInfo, SyndicateActivity } from '@/domains/lottery/types';

// USDC on Base (6 decimals)
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

/**
 * Verify a USDC transfer txHash on-chain.
 * Confirms: tx succeeded, recipient matches poolAddress, amount >= expected.
 */
async function verifyUsdcTransfer({
  txHash,
  expectedRecipient,
  expectedAmountUsdc,
}: {
  txHash: `0x${string}`;
  expectedRecipient: string;
  expectedAmountUsdc: number;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const receipt = await basePublicClient.getTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      return { ok: false, reason: 'Transaction reverted or failed on-chain.' };
    }

    // ERC-20 Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    const transferLog = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() === USDC_BASE.toLowerCase() &&
        log.topics[0] === TRANSFER_TOPIC &&
        log.topics[2] &&
        `0x${log.topics[2].slice(26)}`.toLowerCase() === expectedRecipient.toLowerCase()
    );

    if (!transferLog) {
      return { ok: false, reason: 'No USDC Transfer to pool address found in transaction logs.' };
    }

    // Decode the value from the log data (uint256, big-endian hex)
    const transferredWei = BigInt(transferLog.data);
    const expectedWei = parseUnits(String(expectedAmountUsdc), 6);

    if (transferredWei < expectedWei) {
      return {
        ok: false,
        reason: `Transferred amount (${transferredWei}) is less than expected (${expectedWei}).`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: `Receipt lookup failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

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

  // Use actual ticket tracking data
  const totalPooled = parseFloat(pool.total_pooled_usdc);
  const ticketsPurchased = pool.tickets_purchased || 0;
  const totalImpact = parseFloat(pool.total_impact_usdc || '0') || totalPooled * 0.2; // Fallback to calculation

  // Determine pool address based on pool type
  const poolAddress = pool.pool_type === 'splits' && pool.split_address 
    ? pool.split_address 
    : pool.pool_type === 'pooltogether' && pool.pt_vault_address
    ? pool.pt_vault_address
    : pool.safe_address || pool.coordinator_address;

  return {
    id: pool.id,
    name: pool.name,
    model: 'altruistic', // Default model
    distributionModel: 'proportional',
    poolAddress: poolAddress,
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
    vaultStrategy: (pool.vault_strategy as any) || 'aave', // Use actual vault strategy
    lotteryId: pool.lottery_id ?? undefined,
    membersCount: pool.members_count,
    ticketsPooled: ticketsPurchased,
    ticketsPurchased: ticketsPurchased,
    totalImpact: totalImpact,
    isActive: pool.is_active,
    isTrending: pool.members_count > 1000, // Simple trending logic
    recentActivity: [], // Would be populated from activity tracking in production
    // Pool type support
    poolType: pool.pool_type || 'safe',
    safeAddress: pool.safe_address || undefined,
    splitAddress: pool.split_address || undefined,
    ptVaultAddress: pool.pt_vault_address || undefined,
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
      const { name, description, coordinatorAddress, causeAllocationPercent, lotteryId, poolType, members } = body;
      
      // Validation
      if (!name || !coordinatorAddress || causeAllocationPercent === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: name, coordinatorAddress, causeAllocationPercent' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Validate pool type if provided
      const validPoolTypes = ['safe', 'splits', 'pooltogether'];
      if (poolType && !validPoolTypes.includes(poolType)) {
        return NextResponse.json(
          { error: `Invalid pool type. Must be one of: ${validPoolTypes.join(', ')}` },
          { status: 400, headers: corsHeaders }
        );
      }

      const poolId = await syndicateService.createPool({
        name,
        description,
        coordinatorAddress,
        causeAllocationPercent,
        poolType: poolType || 'safe',
        members,
      });

      return NextResponse.json({ id: poolId, success: true }, { headers: corsHeaders });
    }

    if (action === 'join') {
      const { poolId, memberAddress, amountUsdc, txHash } = body;
      
      // Validation
      if (!poolId || !memberAddress || !amountUsdc) {
        return NextResponse.json(
          { error: 'Missing required fields: poolId, memberAddress, amountUsdc' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Require on-chain proof of transfer
      if (!txHash) {
        return NextResponse.json(
          { error: 'Missing txHash: on-chain USDC transfer must be completed before joining' },
          { status: 400, headers: corsHeaders }
        );
      }

      if (!isHex(txHash)) {
        return NextResponse.json(
          { error: 'Invalid txHash format.' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Fetch pool to get the pool address for receipt verification
      const pool = await syndicateRepository.getPoolById(poolId);
      if (!pool) {
        return NextResponse.json(
          { error: 'Syndicate pool not found.' },
          { status: 404, headers: corsHeaders }
        );
      }

      const verification = await verifyUsdcTransfer({
        txHash: txHash as `0x${string}`,
        expectedRecipient: pool.coordinator_address,
        expectedAmountUsdc: Number(amountUsdc),
      });

      if (!verification.ok) {
        return NextResponse.json(
          { error: `Transaction verification failed: ${verification.reason}` },
          { status: 400, headers: corsHeaders }
        );
      }

      await syndicateRepository.addMember({
        poolId,
        memberAddress,
        amountUsdc: String(amountUsdc),
        txHash,
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

      // Record ticket purchase if successful
      if (result.success && result.txHash) {
        await syndicateRepository.recordTicketPurchase(poolId, ticketCount, result.txHash);
      }

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