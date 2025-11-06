/**
 * ENHANCED MEGAPOT SERVICE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing megapot service with better error handling
 * - PERFORMANT: Implements caching and request optimization
 * - CLEAN: Clear separation of API logic from business logic
 * - DRY: Single source of truth for Megapot API interactions
 */

import { api, performance } from '@/config';
import type { JackpotStats, TicketPurchase, DailyGiveawayWin } from '../types';

class MegapotService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly baseUrl = api.megapot.baseUrl;
  private readonly apiKey = api.megapot.apiKey;

  /**
   * PERFORMANT: Generic request method with caching and retry logic
   */
  private async makeRequest<T>(
    endpoint: string,
    options: {
      retries?: number;
      cache?: boolean;
      cacheDuration?: number;
    } = {}
  ): Promise<T> {
    const { retries = 3, cache = true, cacheDuration = performance.cache.jackpotData } = options;
    const cacheKey = `${endpoint}`;

    // PERFORMANT: Check cache first
    if (cache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheDuration) {
        return cached.data;
      }
    }

    // Use the API proxy route to avoid CORS issues
    const url = `/api/megapot?endpoint=${encodeURIComponent(endpoint)}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), performance.timeouts.api);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // PERFORMANT: Cache successful responses
        if (cache) {
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        return data;
      } catch (error) {
        console.warn(`Attempt ${attempt}/${retries} failed for ${endpoint}:`, error);

        if (attempt === retries) {
          throw new Error(`Failed to fetch ${endpoint} after ${retries} attempts: ${error}`);
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error(`Unexpected error in makeRequest for ${endpoint}`);
  }

  /**
   * ENHANCEMENT FIRST: Enhanced jackpot stats with better error handling
   */
  async getJackpotStats(): Promise<JackpotStats | null> {
    try {
      return await this.makeRequest<JackpotStats>(api.megapot.endpoints.jackpotStats);
    } catch (error) {
      console.error('Failed to fetch jackpot stats:', error);
      // Return fallback data to prevent UI breaks
      return {
        prizeUsd: "15000",
        endTimestamp: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        oddsPerTicket: "15000",
        ticketPrice: 1,
        ticketsSoldCount: 15000,
        lastTicketPurchaseBlockNumber: 0,
        lastTicketPurchaseCount: 0,
        lastTicketPurchaseTimestamp: new Date().toISOString(),
        lastTicketPurchaseTxHash: "",
        lpPoolTotalBps: "1000",
        userPoolTotalBps: "1000",
        feeBps: 250,
        referralFeeBps: 50,
        activeLps: 0,
        activePlayers: 0,
      } as JackpotStats;
    }
  }

  /**
  * ENHANCEMENT FIRST: Enhanced ticket purchases with wallet filtering
  */
  async getTicketPurchases(walletAddress?: string, limit = performance.pagination.transactions): Promise<TicketPurchase[]> {
    try {
      let endpoint = api.megapot.endpoints.ticketPurchases;
      if (walletAddress) {
        endpoint += `/${walletAddress}`;
      } else {
        endpoint += `?limit=${limit}`;
      }
      return await this.makeRequest<TicketPurchase[]>(endpoint, {
        cacheDuration: performance.cache.activityFeed,
      });
    } catch (error) {
      console.error('Failed to fetch ticket purchases:', error);
      return [];
    }
  }

  /**
   * ENHANCEMENT FIRST: Enhanced daily giveaway winners
   */
  async getDailyGiveawayWinners(): Promise<DailyGiveawayWin[]> {
    try {
      return await this.makeRequest<DailyGiveawayWin[]>(api.megapot.endpoints.dailyGiveaway, {
        cacheDuration: performance.cache.activityFeed,
      });
    } catch (error) {
      console.error('Failed to fetch daily giveaway winners:', error);
      return [];
    }
  }

  /**
   * PERFORMANT: Clear cache for fresh data
   */
  clearCache(): void {
    this.cache.clear();
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