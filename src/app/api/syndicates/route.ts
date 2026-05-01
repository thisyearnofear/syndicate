import { NextResponse } from 'next/server';
import { isHex, parseUnits } from 'viem';
import { basePublicClient } from '@/lib/baseClient';
import { syndicateService } from '@/domains/syndicate/services/syndicateService';
import { syndicateRepository, type SyndicatePoolRow } from '@/lib/db/repositories/syndicateRepository';
import type { SyndicateInfo } from '@/domains/lottery/types';
import { ERC20_TRANSFER_TOPIC } from '@/abis/erc20';
import { getCorsHeaders, apiError, apiSuccess, apiValidationError, apiNotFound, checkRateLimit, rateLimitError, getSafeErrorMessage } from '@/lib/api/response';
import { logger } from '@/lib/logger';

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

    const transferLog = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() === USDC_BASE.toLowerCase() &&
        log.topics[0] === ERC20_TRANSFER_TOPIC &&
        log.topics[2] &&
        `0x${log.topics[2].slice(26)}`.toLowerCase() === expectedRecipient.toLowerCase()
    );

    if (!transferLog) {
      return { ok: false, reason: 'No USDC Transfer to pool address found in transaction logs.' };
    }

    const transferredWei = BigInt(transferLog.data);
    const expectedWei = parseUnits(String(expectedAmountUsdc), 6);

    if (transferredWei < expectedWei) {
      return {
        ok: false,
        reason: `Transferred amount is less than expected.`,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: 'Receipt lookup failed.',
    };
  }
}

// CORS headers - use shared utility
function corsHeaders(origin?: string | null) {
  return getCorsHeaders(origin);
}

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
    vaultStrategy: (pool.vault_strategy as SyndicateInfo['vaultStrategy']) || 'aave',
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
  // Rate limit
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'anonymous';
  const rl = checkRateLimit(`syndicates:${ip}`);
  if (!rl.allowed) return rateLimitError(rl.resetAt);

  try {
    const url = new URL(request.url);
    const syndicateId = url.searchParams.get('id');

    if (syndicateId) {
      const pool = await syndicateRepository.getPoolById(syndicateId);
      if (!pool) return apiNotFound('Syndicate not found');
      const syndicate = mapPoolToSyndicateInfo(pool);
      return apiSuccess(syndicate);
    }

    const pools = await syndicateRepository.getActivePools();
    const syndicates = pools.map(mapPoolToSyndicateInfo);
    return apiSuccess(syndicates);
  } catch (error) {
    logger.error('Error fetching syndicates', { error: getSafeErrorMessage(error) });
    return apiError('Failed to fetch syndicates', 500);
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'anonymous';
  const rl = checkRateLimit(`syndicates-post:${ip}`, { windowMs: 60_000, maxRequests: 30 });
  if (!rl.allowed) return rateLimitError(rl.resetAt);

  try {
    const body = await request.json();
    const action = body?.action;

    if (action === 'snapshot') {
      const syndicateId = body?.syndicateId as string;
      const participants = (body?.participants || []) as Array<{ address: string; contributionUsd: number }>;
      const lockMinutes = (body?.lockMinutes ?? 60) as number;
      const roundId = body?.roundId as string | undefined;
      const snapshot = syndicateService.snapshotProportionalWeights(syndicateId, participants, lockMinutes, roundId);
      return apiSuccess(snapshot);
    }

    if (action === 'create') {
      const { name, description, coordinatorAddress, causeAllocationPercent, poolType, members } = body;
      
      if (!name || !coordinatorAddress || causeAllocationPercent === undefined) {
        return apiValidationError('Missing required fields: name, coordinatorAddress, causeAllocationPercent');
      }

      const validPoolTypes = ['safe', 'splits', 'pooltogether', 'fhenix'];
      if (poolType && !validPoolTypes.includes(poolType)) {
        return apiValidationError(`Invalid pool type. Must be one of: ${validPoolTypes.join(', ')}`);
      }

      const poolId = await syndicateService.createPool({
        name,
        description,
        coordinatorAddress,
        causeAllocationPercent,
        poolType: poolType || 'safe',
        members,
      });

      return apiSuccess({ id: poolId, success: true });
    }

    if (action === 'join') {
      const { poolId, memberAddress, amountUsdc, txHash } = body;
      
      if (!poolId || !memberAddress || !amountUsdc) {
        return apiValidationError('Missing required fields: poolId, memberAddress, amountUsdc');
      }

      if (!txHash) {
        return apiValidationError('Missing txHash: on-chain USDC transfer must be completed before joining');
      }

      if (!isHex(txHash)) {
        return apiValidationError('Invalid txHash format.');
      }

      const pool = await syndicateRepository.getPoolById(poolId);
      if (!pool) return apiNotFound('Syndicate pool not found.');

      // Fhenix FHE pools emit DepositShielded(from, 0) — no plaintext amount in event.
      let verification: { ok: boolean; reason?: string };
      if (pool.pool_type === 'fhenix') {
        const { createPublicClient, http, decodeEventLog, parseAbiItem } = await import('viem');

        const fhenixChainId = parseInt(process.env.NEXT_PUBLIC_FHENIX_CHAIN_ID ?? '84532', 10);
        const rpcUrl =
          fhenixChainId === 8008135
            ? (process.env.FHENIX_RPC_URL ?? 'https://api.fhenix.zone')
            : (process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org');

        const client = createPublicClient({ transport: http(rpcUrl) });

        const expectedVault = (process.env.NEXT_PUBLIC_FHENIX_VAULT_ADDRESS ?? '').toLowerCase();
        const depositEvent = parseAbiItem('event DepositShielded(address indexed from, uint256 placeholder)');
        try {
          const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
          if (receipt.status !== 'success') {
            verification = { ok: false, reason: 'FHE deposit transaction reverted' };
          } else if (expectedVault && (receipt.to?.toLowerCase() !== expectedVault)) {
            verification = { ok: false, reason: 'FHE deposit was not sent to the expected vault' };
          } else {
            const matched = receipt.logs.some((log) => {
              if (!expectedVault) return false;
              if (log.address.toLowerCase() !== expectedVault) return false;
              try {
                const decoded = decodeEventLog({
                  abi: [depositEvent],
                  data: log.data,
                  topics: log.topics,
                });
                return (
                  decoded.eventName === 'DepositShielded' &&
                  String((decoded.args as Record<string, unknown>).from).toLowerCase() === String(memberAddress).toLowerCase()
                );
              } catch {
                return false;
              }
            });

            verification = matched
              ? { ok: true }
              : { ok: false, reason: 'FHE deposit event not found (DepositShielded)' };
          }
        } catch {
          verification = { ok: false, reason: 'Could not fetch FHE deposit transaction receipt' };
        }
      } else {
        verification = await verifyUsdcTransfer({
          txHash: txHash as `0x${string}`,
          expectedRecipient: pool.coordinator_address,
          expectedAmountUsdc: Number(amountUsdc),
        });
      }

      if (!verification.ok) {
        return apiValidationError(`Transaction verification failed: ${verification.reason}`);
      }

      await syndicateRepository.addMember({
        poolId,
        memberAddress,
        amountUsdc: String(amountUsdc),
        txHash,
      });

      return apiSuccess({ success: true });
    }

    if (action === 'executePurchase') {
      const { poolId, ticketCount, coordinatorAddress } = body;
      
      if (!poolId || !ticketCount || !coordinatorAddress) {
        return apiValidationError('Missing required fields: poolId, ticketCount, coordinatorAddress');
      }

      const result = await syndicateService.executeSyndicatePurchase(
        poolId,
        ticketCount,
        coordinatorAddress
      );

      if (result.success && result.txHash) {
        await syndicateRepository.recordTicketPurchase(poolId, ticketCount);
      }

      return apiSuccess(result);
    }

    return apiValidationError('Unsupported action. Supported: snapshot, create, join, executePurchase');
  } catch (error) {
    logger.error('Error in POST /api/syndicates', { error: getSafeErrorMessage(error) });
    return apiError('Invalid request', 400);
  }
}
