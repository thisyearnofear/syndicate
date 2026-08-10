/**
 * ENHANCED MEGAPOT SERVICE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing megapot service with better error handling
 * - PERFORMANT: Implements caching and request optimization
 * - CLEAN: Clear separation of API logic from business logic
 * - DRY: Single source of truth for Megapot API interactions
 * - MODULAR: Supports both direct and permitted (Advanced Permissions) purchases
 */

import { CHAIN_IDS } from '@/config';
import type { JackpotStats, TicketPurchase, DailyGiveawayWin, PurchaseResult } from '../types';
import { getMegapotOnChainPrize } from '@/services/lotteries/OnChainFallbackService';
import {
  getActiveRound,
  getLatestSettledRound,
  getRoundWins,
  getWalletTickets,
  megapotAmountToUsd,
  clearMegapotApiCache,
} from '@/services/lotteries/megapotDataApi';
import { logger } from '@/lib/logger';

/**
 * Jackpot (5 normal balls + bonusball) combinations for drawing config:
 * C(normalsMax, 5) * bonusballMax. Base mainnet currently runs 30/10 →
 * 1 in 1,425,060 per ticket.
 */
function jackpotOddsFromBallPool(normalsMax: number, bonusballMax: number): string {
  if (normalsMax < 5 || bonusballMax < 1) return '';
  let combinations = 1;
  for (let i = 0; i < 5; i++) {
    combinations = (combinations * (normalsMax - i)) / (i + 1);
  }
  return String(Math.round(combinations * bonusballMax));
}

class MegapotService {
  private cache = new Map<string, { data: unknown; timestamp: number }>();

  /**
   * Jackpot stats come primarily from the official Megapot Data API
   * (api.megapot.io/v1/rounds/active) — see docs.megapot.io/build-on-megapot/pull-data.
   * If the API is unreachable (network/geo), we fall back to reading the
   * contract on Base via getOnChainFallback(). Both paths fail quietly with
   * null so the UI can render its stable fallback.
   */
  async getJackpotStats(): Promise<JackpotStats | null> {
    const round = await getActiveRound();
    if (round) {
      return {
        prizeUsd: megapotAmountToUsd(round.prize_pool),
        totalPoolUsd: '0', // Not exposed by the Data API; LP earnings accrue per-round.
        endTimestamp: round.ended_at ? String(new Date(round.ended_at).getTime()) : '',
        // True jackpot odds per ticket: 1 / (C(normals_max, 5) * bonusball_max).
        // ball ranges are per-drawing config from the round itself, never hardcoded.
        oddsPerTicket: jackpotOddsFromBallPool(round.ball_pool.normals_max, round.ball_pool.bonusball_max),
        ticketPrice: 1,
        ticketsSoldCount: round.ticket_count,
        lastTicketPurchaseBlockNumber: 0,
        lastTicketPurchaseCount: 0,
        lastTicketPurchaseTimestamp: round.started_at || '',
        lastTicketPurchaseTxHash: '',
        lpPoolTotalBps: megapotAmountToUsd(round.lp_earnings),
        userPoolTotalBps: '0',
        feeBps: 0,
        referralFeeBps: 0,
        activeLps: 0,
        activePlayers: round.unique_participants,
      };
    }

    logger.info('[MegapotService] Data API unreachable, using on-chain fallback');
    return this.getOnChainFallback();
  }

   /**
    * Read Megapot prize data directly from the contract on Base
    */
   private async getOnChainFallback(): Promise<JackpotStats | null> {
     try {
       const onChainData = await getMegapotOnChainPrize();
       
       if (!onChainData) return null;
       
        logger.info('[MegapotService] Successfully fetched jackpot from chain', { prizeUsd: onChainData.prizeUsd });
       
       return {
         prizeUsd: onChainData.prizeUsd,
         totalPoolUsd: onChainData.totalDepositsUsd,
         endTimestamp: String(onChainData.nextDrawTimestamp),
         // Current Base mainnet ball config (30 normals / 10 bonus) → 1 in
         // C(30,5)*10 = 1,425,060 per ticket. Same computation as the API path.
         oddsPerTicket: jackpotOddsFromBallPool(30, 10),
         ticketPrice: 1,
         ticketsSoldCount: Number(onChainData.ticketCount) || 0,
         lastTicketPurchaseBlockNumber: 0,
         lastTicketPurchaseCount: 0,
         lastTicketPurchaseTimestamp: String(Date.now()),
         lastTicketPurchaseTxHash: '',
         lpPoolTotalBps: '0',
         userPoolTotalBps: '0',
         feeBps: 0,
         referralFeeBps: 0,
         activeLps: 0,
         activePlayers: 0,
       };
     } catch (error) {
        logger.error('[MegapotService] On-chain fallback also failed', { error: String(error) });
       return null;
     }
   }

  /**
   * Wallet ticket history from the official Megapot Data API
   * (GET /v1/wallets/{address}/tickets). One row per ticket: the API is
   * per-ticket, not per-purchase, so each legacy TicketPurchase row
   * represents a single ticket (ticketsPurchased: 1).
   */
  async getTicketPurchases(walletAddress?: string, limit?: number): Promise<TicketPurchase[]> {
    if (!walletAddress) return [];
    const page = await getWalletTickets(walletAddress, limit ?? 50);
    if (!page) return [];

    return page.data.map((ticket) => ({
      jackpotRoundId: Number(ticket.round_id),
      recipient: ticket.wallet,
      // Referrer attribution lives on-chain only (bytes32 _source is not
      // queryable through the Data API per Megapot docs), so we report
      // an empty string rather than guessing.
      referrer: '',
      buyer: ticket.buyer,
      transactionHashes: [ticket.tx_hash],
      ticketsPurchasedTotalBps: 0,
      ticketsPurchased: 1,
      startTicket: 0,
      endTicket: 0,
    }));
  }

  /**
   * Historical name — now returns the top wins of the latest settled round
   * from the Data API (GET /v1/rounds/latest-settled + /rounds/{id}/wins).
   * The legacy "daily giveaway" product was retired upstream.
   */
  async getDailyGiveawayWinners(): Promise<DailyGiveawayWin[]> {
    const latest = await getLatestSettledRound();
    if (!latest) return [];
    const wins = await getRoundWins(latest.id, 50);
    if (!wins) return [];

    return wins.data.map((win) => ({
      jackpotRoundId: Number(latest.id),
      claimTransactionHashes: win.claimed_tx_hash ? [win.claimed_tx_hash] : [],
      claimedAt: latest.settled_at || '',
      drawingBlockNumber: win.block_number,
      prizeValueTotal: Number(megapotAmountToUsd(win.amount)),
    }));
  }

  /**
    * ENHANCEMENT FIRST: Execute ticket purchase with Advanced Permissions
    * 
    * CLEAN: Automated purchase execution where:
    * - User has granted permission to spend X USDC per period
    * - Called from permittedTicketExecutor or backend cron job
    * - No additional user approval needed
    * 
    * MODULAR: Can be called from:
    * - Automation service (recurring purchases on schedule)
    * - Backend cron job (periodic execution)
    * - Frontend automation trigger
    */
  async executePurchaseWithPermission(params: {
    userAddress: string;
    permissionId: string;
    ticketCount: number;
    amountUsdc: bigint;
    tokenAddress: string;
    chainId?: number;
  }): Promise<PurchaseResult> {
    try {
      // Verify this is Base (where Megapot lives)
      const targetChain = params.chainId || CHAIN_IDS.BASE;
      if (targetChain !== CHAIN_IDS.BASE) {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: 'Megapot lottery is only on Base.',
          },
        };
      }

      // PERFORMANT: Check cache for recent execution
      const executionCacheKey = `execution:${params.permissionId}:${params.userAddress}`;
      const cachedExecution = this.cache.get(executionCacheKey) as { data: { txHash: string }; timestamp: number } | undefined;
      
      if (cachedExecution && Date.now() - cachedExecution.timestamp < 5000) {
        // Same execution requested within 5 seconds, return cached result
        return {
          success: true,
          txHash: cachedExecution.data.txHash,
          mode: 'individual',
        };
      }

      // Dynamic import web3Service to avoid circular dependency
      const { web3Service } = await import('@/services/web3Service');
      
      // Verify web3Service is initialized (should be from frontend context)
      // For backend execution, we'll use read-only initialization
      if (!web3Service.isReady()) {
        const { CHAINS } = await import('@/config');
        await web3Service.initialize(CHAINS.base.rpcUrl);
      }

      // CLEAN: Execute the purchase using web3Service
      const txHash = await web3Service.purchaseTicketsWithDelegation(
        params.userAddress,
        params.ticketCount,
        params.amountUsdc
      );

      // PERFORMANT: Cache successful execution
      this.cache.set(executionCacheKey, { data: { txHash }, timestamp: Date.now() });

      return {
        success: true,
        txHash,
        mode: 'individual',
      };
    } catch (error) {
      logger.error('Failed to execute permitted purchase', { error: String(error) });
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        error: {
          code: 'CONTRACT_ERROR',
          message: `Purchase failed: ${message}`,
        },
      };
    }
  }

  /**
    * PERFORMANT: Clear cache for fresh data (execution cache + Data API cache)
    */
  clearCache(): void {
    this.cache.clear();
    clearMegapotApiCache();
  }

  /**
    * PERFORMANT: Get cache status for debugging
    */
  getCacheStatus(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
  }

  // CLEAN: Export singleton instance
  export const megapotService = new MegapotService();

  // CLEAN: Export class for testing
  export { MegapotService };
