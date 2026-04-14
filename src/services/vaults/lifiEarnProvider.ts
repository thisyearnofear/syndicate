/**
 * LI.FI EARN VAULT PROVIDER
 *
 * Core Principles Applied:
 * - MODULAR: Isolated LI.FI Earn integration implementing VaultProvider
 * - DRY: Uses existing VaultProvider interface, no parallel systems
 * - CLEAN: API routes are internal implementation detail
 * - PERFORMANT: Caches vault data with TTL
 *
 * LI.FI Earn provides 20+ vault protocols across 60+ chains with
 * one-click deposit execution via Composer (swap + deposit in single tx).
 *
 * This provider acts as a vault aggregator - users see LI.FI Earn vaults
 * as yield options that can source from any supported chain/protocol.
 */

import type {
    VaultProvider,
    VaultBalance,
    VaultDepositResult,
    VaultWithdrawResult,
    VaultProtocol,
} from './vaultProvider';
import { VaultError, VaultErrorCode } from './vaultProvider';

// LI.FI Earn API configuration
const EARN_API_BASE_URL = '/api/lifi/earn';
const APY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface LifiEarnVault {
    address: string;
    chainId: number;
    network: string;
    slug: string;
    name: string;
    description: string;
    protocol: {
        name: string;
        url: string;
    };
    underlyingTokens: Array<{
        address: string;
        symbol: string;
        decimals: number;
    }>;
    tags: string[];
    analytics: {
        apy: {
            base: number;
            reward: number | null;
            total: number;
        };
        apy1d: number | null;
        apy7d: number | null;
        apy30d: number | null;
        tvl: { usd: string };
        updatedAt: string;
    };
    isTransactional: boolean;
    isRedeemable: boolean;
}

export class LifiEarnVaultProvider implements VaultProvider {
    readonly name: VaultProtocol = 'lifiearn';
    readonly chainId: number = 8453; // Base is primary destination

    // Cache for vault data
    private cachedVaults: { data: LifiEarnVault[]; timestamp: number } | null = null;
    private cachedAPY: { value: number; timestamp: number } | null = null;

    /**
     * Fetch available vaults from LI.FI Earn API
     */
    async fetchVaults(chainId?: number): Promise<LifiEarnVault[]> {
        const now = Date.now();
        if (this.cachedVaults && now - this.cachedVaults.timestamp < APY_CACHE_TTL) {
            return this.cachedVaults.data;
        }

        try {
            const params = new URLSearchParams();
            if (chainId) params.set('chainId', String(chainId));
            params.set('limit', '50');

            const response = await fetch(`${EARN_API_BASE_URL}/vaults?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch vaults: ${response.statusText}`);
            }

            const result = await response.json();
            const vaults = result.data || [];

            this.cachedVaults = { data: vaults, timestamp: now };
            return vaults;
        } catch (error) {
            console.error('[LifiEarn] Failed to fetch vaults:', error);
            return this.cachedVaults?.data || [];
        }
    }

    /**
     * Get user's balance across LI.FI Earn positions
     * Aggregates all positions for the user
     */
    async getBalance(userAddress: string): Promise<VaultBalance> {
        try {
            const response = await fetch(`${EARN_API_BASE_URL}/portfolio?address=${userAddress}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch portfolio: ${response.statusText}`);
            }

            const result = await response.json();
            const positions = result.positions || [];

            // Aggregate all positions
            const totalBalance = positions.reduce((sum: number, pos: any) => {
                return sum + parseFloat(pos.balanceUsd || '0');
            }, 0);

            const apy = await this.getCurrentAPY();

            return {
                deposited: totalBalance.toFixed(6),
                yieldAccrued: '0', // LI.FI Earn positions auto-compound
                totalBalance: totalBalance.toFixed(6),
                apy,
                lastUpdated: Date.now(),
            };
        } catch (error) {
            console.error('[LifiEarn] Failed to get balance:', error);
            return {
                deposited: '0',
                yieldAccrued: '0',
                totalBalance: '0',
                apy: 0,
                lastUpdated: Date.now(),
            };
        }
    }

    /**
     * Get yield accrued (simplified - LI.FI Earn auto-compounds)
     */
    async getYieldAccrued(userAddress: string): Promise<string> {
        const balance = await this.getBalance(userAddress);
        return balance.yieldAccrued;
    }

    /**
     * Check if LI.FI Earn is healthy (API responsive)
     */
    async isHealthy(): Promise<boolean> {
        try {
            const response = await fetch(`${EARN_API_BASE_URL}/vaults?limit=1`);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get current APY - returns average APY of top vaults
     */
    async getCurrentAPY(): Promise<number> {
        const now = Date.now();
        if (this.cachedAPY && now - this.cachedAPY.timestamp < APY_CACHE_TTL) {
            return this.cachedAPY.value;
        }

        try {
            const vaults = await this.fetchVaults(8453); // Base vaults
            const transactionalVaults = vaults.filter((v: LifiEarnVault) => v.isTransactional);

            if (transactionalVaults.length === 0) return 0;

            // Calculate weighted average APY by TVL
            const totalTvl = transactionalVaults.reduce((sum, v) => {
                return sum + parseFloat(v.analytics.tvl.usd);
            }, 0);

            const weightedApy = transactionalVaults.reduce((sum, v) => {
                const weight = parseFloat(v.analytics.tvl.usd) / totalTvl;
                return sum + (v.analytics.apy.total * weight);
            }, 0);

            this.cachedAPY = { value: weightedApy, timestamp: now };
            return weightedApy;
        } catch (error) {
            return this.cachedAPY?.value ?? 0;
        }
    }

    /**
     * Deposit via LI.FI Composer
     * This is handled client-side via useVaultDeposit hook
     * Returns metadata for the deposit
     */
    async deposit(amount: string, userAddress: string): Promise<VaultDepositResult> {
        // LI.FI Earn deposits require the client-side Composer flow
        // The useVaultDeposit hook handles the actual execution
        return {
            success: false,
            error: 'LI.FI Earn deposits require Composer execution. Use useVaultDeposit with crossChainDeposit.',
            vaultId: 'lifiearn:aggregator',
        };
    }

    /**
     * Withdraw from LI.FI Earn vault
     * Requires Composer execution
     */
    async withdraw(amount: string, userAddress: string): Promise<VaultWithdrawResult> {
        return {
            success: false,
            error: 'LI.FI Earn withdrawals require Composer execution. Use useVaultDeposit with crossChainWithdraw.',
        };
    }

    /**
     * Withdraw yield only
     */
    async withdrawYield(userAddress: string): Promise<VaultWithdrawResult> {
        return {
            success: false,
            error: 'LI.FI Earn auto-compounds yield. Withdraw full amount to access.',
        };
    }

    /**
     * Get best vault for a specific chain and token
     */
    async getBestVault(
        chainId: number,
        tokenSymbol: string = 'USDC'
    ): Promise<LifiEarnVault | null> {
        const vaults = await this.fetchVaults(chainId);
        const eligible = vaults.filter(
            (v) =>
                v.isTransactional &&
                v.underlyingTokens.some((t) => t.symbol === tokenSymbol)
        );

        if (eligible.length === 0) return null;

        return eligible.reduce((best, current) =>
            current.analytics.apy.total > best.analytics.apy.total ? current : best
        );
    }

    /**
     * Format TVL for display
     */
    formatTvl(tvlUsd: string): string {
        const num = Number(tvlUsd);
        if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
        if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
        if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
        return `$${num.toFixed(0)}`;
    }
}

export const lifiEarnProvider = new LifiEarnVaultProvider();
