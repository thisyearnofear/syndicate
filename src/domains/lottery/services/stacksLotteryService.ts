/**
 * ENHANCED STACKS LOTTERY SERVICE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Extends existing megapot service for Stacks integration
 * - DRY: Reuses existing patterns and structures
 * - CLEAN: Clear separation between Stacks and Base lottery logic
 * - MODULAR: Composable service following existing patterns
 */

import { api, performance } from '@/config';
import type { JackpotStats, TicketPurchase, DailyGiveawayWin } from '../types';

class StacksLotteryService {
    private cache = new Map<string, { data: unknown; timestamp: number }>();
    private readonly baseUrl = api.stacks.baseUrl;
    private readonly apiKey = api.stacks.apiKey;

    /**
     * PERFORMANT: Generic request method with caching and retry logic
     * Enhanced from megapot service for Stacks-specific handling
     */
    private async makeRequest<T>(
        endpoint: string,
        options: {
            retries?: number;
            cache?: boolean;
            cacheDuration?: number;
            method?: 'GET' | 'POST';
            body?: any;
        } = {}
    ): Promise<T> {
        const { retries = 3, cache = true, cacheDuration = performance.cache.jackpotData, method = 'GET', body } = options;
        const cacheKey = `stacks_${endpoint}_${method}_${JSON.stringify(body)}`;

        // PERFORMANT: Check cache first
        if (cache && method === 'GET') {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < cacheDuration) {
                return cached.data as T;
            }
        }

        // Use the API proxy route to avoid CORS issues (similar to megapot)
        const url = `/api/stacks-lottery?endpoint=${encodeURIComponent(endpoint)}`;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), performance.timeouts.api);

                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: body ? JSON.stringify(body) : undefined,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                // PERFORMANT: Cache successful responses
                if (cache && method === 'GET') {
                    this.cache.set(cacheKey, { data, timestamp: Date.now() });
                }

                return data;
            } catch (error) {
                console.warn(`Attempt ${attempt}/${retries} failed for Stacks ${endpoint}:`, error);

                if (attempt === retries) {
                    throw new Error(`Failed to fetch Stacks ${endpoint} after ${retries} attempts: ${error}`);
                }

                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }

        throw new Error(`Unexpected error in makeRequest for Stacks ${endpoint}`);
    }

    /**
     * ENHANCEMENT FIRST: Enhanced jackpot stats with Stacks-specific handling
     */
    async getJackpotStats(): Promise<JackpotStats | null> {
        try {
            return await this.makeRequest<JackpotStats>(api.stacks.endpoints.jackpotStats);
        } catch (error) {
            console.error('Failed to fetch Stacks jackpot stats:', error);
            // Return fallback data similar to megapot service
            return {
                prizeUsd: "15000",
                endTimestamp: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
                oddsPerTicket: "15000",
                ticketPrice: 1, // $1 per ticket in sBTC equivalent
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
     * ENHANCEMENT FIRST: Enhanced ticket purchases with Stacks wallet filtering
     */
    async getTicketPurchases(walletAddress?: string, limit = performance.pagination.transactions): Promise<TicketPurchase[]> {
        try {
            let endpoint = api.stacks.endpoints.ticketPurchases;
            if (walletAddress) {
                endpoint += `/${walletAddress}`;
            } else {
                endpoint += `?limit=${limit}`;
            }
            return await this.makeRequest<TicketPurchase[]>(endpoint, {
                cacheDuration: performance.cache.activityFeed,
            });
        } catch (error) {
            console.error('Failed to fetch Stacks ticket purchases:', error);
            return [];
        }
    }

    /**
     * ENHANCEMENT FIRST: Enhanced daily giveaway winners
     */
    async getDailyGiveawayWinners(): Promise<DailyGiveawayWin[]> {
        try {
            return await this.makeRequest<DailyGiveawayWin[]>(api.stacks.endpoints.dailyGiveaway, {
                cacheDuration: performance.cache.activityFeed,
            });
        } catch (error) {
            console.error('Failed to fetch Stacks daily giveaway winners:', error);
            return [];
        }
    }

    /**
     * STACKS-SPECIFIC: Get Stacks wallet balance
     */
    async getWalletBalance(walletAddress: string): Promise<{ stx: string; sbtc: string }> {
        try {
            const endpoint = `/address/${walletAddress}/balance`;
            const data = await this.makeRequest<{ stx: string; sbtc: string }>(endpoint);
            return data;
        } catch (error) {
            console.error('Failed to fetch Stacks wallet balance:', error);
            return { stx: "0", sbtc: "0" };
        }
    }

    /**
     * STACKS-SPECIFIC: Bridge sBTC to Base for lottery participation
     */
    async bridgeToBase(walletAddress: string, amount: number): Promise<{ txHash: string; status: string }> {
        try {
            const endpoint = `/bridge/sbtc-to-base`;
            const data = await this.makeRequest<{ txHash: string; status: string }>(endpoint, {
                method: 'POST',
                body: {
                    walletAddress,
                    amount,
                    destinationChain: 'base',
                },
            });
            return data;
        } catch (error) {
            console.error('Failed to bridge sBTC to Base:', error);
            throw new Error(`Bridge failed: ${error}`);
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
export const stacksLotteryService = new StacksLotteryService();

// CLEAN: Export class for testing
export { StacksLotteryService };