/**
 * CONTRACT DATA SERVICE
 * 
 * Core Principles Applied:
 * - MODULAR: Isolated read-only contract queries
 * - CLEAN: Single responsibility for data fetching
 * - PERFORMANT: Intelligent caching with TTL and invalidation
 */

import { ethers } from 'ethers';
import type { BaseChainService } from './BaseChainService';

interface CacheEntry<T> {
    value: T;
    timestamp: number;
    ttl: number;
}

/**
 * Cache configuration for different data types
 */
const CACHE_CONFIG = {
    JACKPOT: 30000,        // 30 seconds - changes frequently
    TICKET_PRICE: 300000,  // 5 minutes - rarely changes
    USER_BALANCE: 10000,   // 10 seconds - changes with transactions
    USER_TICKETS: 15000,   // 15 seconds - changes with purchases
    ODDS: 30000,           // 30 seconds - derived from jackpot
} as const;

export interface UserTicketInfo {
    ticketsPurchased: number;
    winningsClaimable: string;
    isActive: boolean;
    hasWon: boolean;
}

export interface UserBalance {
    usdc: string;
    eth: string;
    hasEnoughUsdc: boolean;
    hasEnoughEth: boolean;
}

export interface OddsInfo {
    oddsPerTicket: number;
    oddsForTickets: (ticketCount: number) => number;
    oddsFormatted: (ticketCount: number) => string;
    potentialWinnings: string;
}

export class ContractDataService {
    private cache = new Map<string, CacheEntry<any>>();

    constructor(
        private baseChain: BaseChainService,
        private megapotContract: ethers.Contract,
        private usdcContract: ethers.Contract
    ) { }

    /**
     * Generic cache getter with TTL
     */
    private getCached<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.value as T;
    }

    /**
     * Generic cache setter
     */
    private setCache<T>(key: string, value: T, ttl: number): void {
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl,
        });
    }

    /**
     * Invalidate specific cache entries
     */
    invalidateCache(pattern?: string): void {
        if (!pattern) {
            this.cache.clear();
            console.log('Cache cleared');
            return;
        }

        const keysToDelete: string[] = [];
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
        console.log(`Invalidated ${keysToDelete.length} cache entries matching: ${pattern}`);
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
        };
    }

    /**
     * Get current jackpot amount with caching
     */
    async getCurrentJackpot(): Promise<string> {
        const cacheKey = 'jackpot';
        const cached = this.getCached<string>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const jackpot = await this.megapotContract.getCurrentJackpot();
            const formatted = ethers.formatUnits(jackpot, 6);
            this.setCache(cacheKey, formatted, CACHE_CONFIG.JACKPOT);
            return formatted;
        } catch (error) {
            console.error('Failed to get jackpot:', error);
            return '0';
        }
    }

    /**
     * Get ticket price with caching
     */
    async getTicketPrice(): Promise<string> {
        const cacheKey = 'ticketPrice';
        const cached = this.getCached<string>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const price = await this.megapotContract.ticketPrice();
            const formatted = ethers.formatUnits(price, 6);
            this.setCache(cacheKey, formatted, CACHE_CONFIG.TICKET_PRICE);
            return formatted;
        } catch (error) {
            console.error('Failed to get ticket price:', error);
            return '1';
        }
    }

    /**
     * Get user balance with caching
     */
    async getUserBalance(): Promise<UserBalance> {
        try {
            const provider = this.baseChain.getProvider();
            if (!provider) throw new Error('Provider not initialized');

            const signer = await this.baseChain.getFreshSigner();
            const address = await signer.getAddress();

            const cacheKey = `balance:${address}`;
            const cached = this.getCached<UserBalance>(cacheKey);
            if (cached !== null) {
                return cached;
            }

            const usdcBalance = await this.usdcContract.balanceOf(address);
            const usdcFormatted = ethers.formatUnits(usdcBalance, 6);

            const ethBalance = await provider.getBalance(address);
            const ethFormatted = ethers.formatEther(ethBalance);

            const result: UserBalance = {
                usdc: usdcFormatted,
                eth: ethFormatted,
                hasEnoughUsdc: parseFloat(usdcFormatted) >= 1,
                hasEnoughEth: parseFloat(ethFormatted) >= 0.001,
            };

            this.setCache(cacheKey, result, CACHE_CONFIG.USER_BALANCE);
            return result;
        } catch (error) {
            console.error('Failed to get user balance:', error);
            return {
                usdc: '0',
                eth: '0',
                hasEnoughUsdc: false,
                hasEnoughEth: false,
            };
        }
    }

    /**
     * Get user ticket info with caching
     */
    async getCurrentTicketInfo(): Promise<UserTicketInfo | null> {
        try {
            const signer = await this.baseChain.getFreshSigner();
            const address = await signer.getAddress();

            const cacheKey = `tickets:${address}`;
            const cached = this.getCached<UserTicketInfo>(cacheKey);
            if (cached !== null) {
                return cached;
            }

            const [ticketsPurchasedTotalBps, winningsClaimable, isActive] =
                await this.megapotContract.usersInfo(address);
            const lastWinner = await this.megapotContract.lastWinnerAddress();

            const ticketsPurchased = Number(ticketsPurchasedTotalBps) / 10000;
            const winningsFormatted = ethers.formatUnits(winningsClaimable, 6);

            const result: UserTicketInfo = {
                ticketsPurchased,
                winningsClaimable: winningsFormatted,
                isActive,
                hasWon: lastWinner.toLowerCase() === address.toLowerCase() &&
                    parseFloat(winningsFormatted) > 0,
            };

            this.setCache(cacheKey, result, CACHE_CONFIG.USER_TICKETS);
            return result;
        } catch (error) {
            console.error('Failed to get ticket info:', error);
            return null;
        }
    }

    /**
     * Get user info for specific address with caching
     */
    async getUserInfoForAddress(address: string): Promise<{
        ticketsPurchased: number;
        winningsClaimable: string;
        isActive: boolean;
        rawValue: bigint;
    } | null> {
        const cacheKey = `userInfo:${address}`;
        const cached = this.getCached<{
            ticketsPurchased: number;
            winningsClaimable: string;
            isActive: boolean;
            rawValue: bigint;
        }>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const userInfo = await this.megapotContract.usersInfo(address);
            const ticketsRaw = userInfo.ticketsPurchasedTotalBps || userInfo[0];
            const winningsRaw = userInfo.winningsClaimable || userInfo[1];
            const activeRaw = userInfo.active || userInfo[2];

            const result = {
                ticketsPurchased: Number(ticketsRaw),
                winningsClaimable: ethers.formatUnits(winningsRaw, 6),
                isActive: Boolean(activeRaw),
                rawValue: ticketsRaw,
            };

            this.setCache(cacheKey, result, CACHE_CONFIG.USER_TICKETS);
            return result;
        } catch (error) {
            console.error('Failed to get user info for address:', error);
            return null;
        }
    }

    /**
     * Check USDC allowance
     */
    async checkUsdcAllowance(ticketCount: number, megapotAddress: string): Promise<boolean> {
        try {
            const signer = await this.baseChain.getFreshSigner();
            const address = await signer.getAddress();

            const allowance = await this.usdcContract.allowance(address, megapotAddress);
            const ticketPrice = await this.megapotContract.ticketPrice();
            const requiredAmount = ticketPrice * BigInt(ticketCount);

            return allowance >= requiredAmount;
        } catch (error) {
            console.error('Failed to check allowance:', error);
            return false;
        }
    }

    /**
     * Calculate odds info with caching
     */
    async getOddsInfo(): Promise<OddsInfo | null> {
        const cacheKey = 'odds';
        const cached = this.getCached<OddsInfo>(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const jackpotSize = await this.megapotContract.getCurrentJackpot();
            const jackpotUSD = parseFloat(ethers.formatUnits(jackpotSize, 6));
            const oddsPerTicket = jackpotUSD / 0.7;

            const result: OddsInfo = {
                oddsPerTicket,
                oddsForTickets: (ticketCount: number) => oddsPerTicket / ticketCount,
                oddsFormatted: (ticketCount: number) => {
                    const odds = oddsPerTicket / ticketCount;
                    return odds < 1 ? 'Better than 1:1' :
                        `1 in ${odds.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                },
                potentialWinnings: jackpotUSD.toFixed(2)
            };

            this.setCache(cacheKey, result, CACHE_CONFIG.ODDS);
            return result;
        } catch (error) {
            console.error('Failed to calculate odds:', error);
            return null;
        }
    }
}
