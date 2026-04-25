/**
 * VAULT MANAGER
 *
 * Core Principles Applied:
 * - MODULAR: Composable vault provider system
 * - DRY: Single entry point for all vault operations
 * - CLEAN: Clear orchestration layer
 *
 * Phase 2: Week 2 - Vault Provider Orchestration
 *
 * Central manager for all vault providers (Aave, Morpho, Spark)
 * Handles provider selection, health checks, and fallback logic
 */

import type {
    VaultProvider,
    VaultProtocol,
    VaultProviderConfig,
    VaultBalance,
    VaultDepositResult,
    VaultWithdrawResult,
} from './vaultProvider';
import { VaultError, VaultErrorCode } from './vaultProvider';
import { aaveProvider } from './aaveProvider';
import { poolTogetherProvider } from './poolTogetherProvider';
import { morphoProvider } from './morphoProvider';
import { sparkProvider } from './sparkProvider';
import { octantProvider } from './octantProvider';
import { uniswapProvider } from './uniswapProvider';
import { lifiEarnProvider } from './lifiEarnProvider';
import { fhenixVaultProvider } from './fhenixProvider';

/**
 * Vault information for UI display
 */
export interface VaultInfo {
    protocol: VaultProtocol;
    name: string;
    description: string;
    chainId: number;
    isHealthy: boolean;
    currentAPY: number;
    tvl?: string; // Total Value Locked (optional)
    icon?: string; // Icon URL (optional)
}

/**
 * User's vault positions across all protocols
 */
export interface UserVaultPosition {
    protocol: VaultProtocol;
    vaultId: string;
    deposited: string;
    yieldAccrued: string;
    totalBalance: string;
    apy: number;
    lastUpdated: number;
}

/**
 * Central vault manager
 * Orchestrates all vault providers and handles provider selection
 */
export class VaultManager {
    private providers: Map<VaultProtocol, VaultProvider>;

    constructor() {
        this.providers = new Map();

        // Register Aave provider
        this.providers.set('aave', aaveProvider);

        // Register PoolTogether provider (Prize Savings)
        this.providers.set('pooltogether', poolTogetherProvider);

        // Register Morpho provider (Lending Vaults)
        this.providers.set('morpho', morphoProvider);

        // Register Spark provider (MakerDAO/Sky Savings)
        this.providers.set('spark', sparkProvider);

        // Register Octant provider (Yield Donating Vaults)
        this.providers.set('octant', octantProvider);

        // Register Uniswap provider (V3 LP Positions)
        this.providers.set('uniswap', uniswapProvider);

        // Register LI.FI Earn provider (Cross-chain vault aggregator)
        this.providers.set('lifiearn', lifiEarnProvider);

        // Register Fhenix FHE provider (Privacy-preserving encrypted vault)
        this.providers.set('fhenix', fhenixVaultProvider);
    }

    /**
     * Get a specific vault provider
     */
    getProvider(protocol: VaultProtocol): VaultProvider {
        const provider = this.providers.get(protocol);

        if (!provider) {
            throw new VaultError(
                `Vault provider not found: ${protocol}`,
                VaultErrorCode.PROVIDER_NOT_FOUND,
                protocol
            );
        }

        return provider;
    }

    /**
     * Get all available vault providers
     */
    getAvailableProviders(): VaultProtocol[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Get vault information for all available providers
     */
    async getAvailableVaults(): Promise<VaultInfo[]> {
        const vaults: VaultInfo[] = [];

        for (const [protocol, provider] of this.providers) {
            try {
                const [isHealthy, currentAPY] = await Promise.all([
                    provider.isHealthy(),
                    provider.getCurrentAPY(),
                ]);

                vaults.push({
                    protocol,
                    name: this.getVaultName(protocol),
                    description: this.getVaultDescription(protocol),
                    chainId: provider.chainId,
                    isHealthy,
                    currentAPY,
                });
            } catch (error) {
                console.error(`Failed to get info for ${protocol}:`, error);
                // Include vault but mark as unhealthy
                vaults.push({
                    protocol,
                    name: this.getVaultName(protocol),
                    description: this.getVaultDescription(protocol),
                    chainId: provider.chainId,
                    isHealthy: false,
                    currentAPY: 0,
                });
            }
        }

        return vaults;
    }

    /**
     * Get user's positions across all vaults
     */
    async getUserVaults(userAddress: string): Promise<UserVaultPosition[]> {
        const positions: UserVaultPosition[] = [];

        for (const [protocol, provider] of this.providers) {
            try {
                const balance = await provider.getBalance(userAddress);

                // Only include if user has a balance
                if (parseFloat(balance.totalBalance) > 0) {
                    positions.push({
                        protocol,
                        vaultId: `${protocol}:${provider.chainId}`,
                        deposited: balance.deposited,
                        yieldAccrued: balance.yieldAccrued,
                        totalBalance: balance.totalBalance,
                        apy: balance.apy,
                        lastUpdated: balance.lastUpdated,
                    });
                }
            } catch (error) {
                console.error(`Failed to get balance for ${protocol}:`, error);
                // Continue with other providers
            }
        }

        return positions;
    }

    /**
     * Get the best vault by APY
     */
    async getBestVaultByAPY(): Promise<VaultInfo | null> {
        const vaults = await this.getAvailableVaults();
        const healthyVaults = vaults.filter(v => v.isHealthy);

        if (healthyVaults.length === 0) return null;

        return healthyVaults.reduce((best, current) =>
            current.currentAPY > best.currentAPY ? current : best
        );
    }

    /**
     * Deposit to a specific vault
     */
    async deposit(
        protocol: VaultProtocol,
        amount: string,
        userAddress: string
    ): Promise<VaultDepositResult> {
        const provider = this.getProvider(protocol);

        // Check vault health before deposit
        const isHealthy = await provider.isHealthy();
        if (!isHealthy) {
            throw new VaultError(
                `Vault ${protocol} is currently unhealthy`,
                VaultErrorCode.VAULT_UNHEALTHY,
                protocol
            );
        }

        return provider.deposit(amount, userAddress);
    }

    /**
     * Withdraw from a specific vault
     */
    async withdraw(
        protocol: VaultProtocol,
        amount: string,
        userAddress: string
    ): Promise<VaultWithdrawResult> {
        const provider = this.getProvider(protocol);
        return provider.withdraw(amount, userAddress);
    }

    /**
     * Withdraw only yield from a specific vault
     */
    async withdrawYield(
        protocol: VaultProtocol,
        userAddress: string
    ): Promise<VaultWithdrawResult> {
        const provider = this.getProvider(protocol);
        return provider.withdrawYield(userAddress);
    }

    /**
     * Get total yield across all vaults for a user
     */
    async getTotalYieldAccrued(userAddress: string): Promise<string> {
        const positions = await this.getUserVaults(userAddress);

        const totalYield = positions.reduce((sum, position) => {
            return sum + parseFloat(position.yieldAccrued);
        }, 0);

        return totalYield.toFixed(6);
    }

    // Helper methods for vault metadata

    private getVaultName(protocol: VaultProtocol): string {
        const names: Record<VaultProtocol, string> = {
            aave: 'Aave V3',
            morpho: 'Morpho Blue',
            spark: 'Spark Protocol',
            pooltogether: 'PoolTogether V5',
            octant: 'Octant V2',
            uniswap: 'Uniswap V3 LP',
            lifiearn: 'LI.FI Earn Aggregator',
            fhenix: 'Fhenix FHE Vault',
        };
        return names[protocol];
    }

    private getVaultDescription(protocol: VaultProtocol): string {
        const descriptions: Record<VaultProtocol, string> = {
            aave: 'Decentralized lending protocol with proven track record',
            morpho: 'Curated lending vaults with optimized yields (~6.7% APY)',
            spark: 'MakerDAO lending protocol with DAI integration',
            pooltogether: 'No-loss prize savings on Base - keep principal, win prizes',
            octant: 'Yield donating vaults with public goods funding (~10% APY)',
            uniswap: 'Concentrated liquidity positions earning trading fees (~8.5% APY)',
            lifiearn: 'Cross-chain vault aggregator with 20+ protocols via LI.FI Earn',
            fhenix: 'Privacy-preserving FHE vault — contribution amounts encrypted on-chain (~5% APY)',
        };
        return descriptions[protocol];
    }
}

// Export singleton instance
export const vaultManager = new VaultManager();

// Re-export types and providers
export * from './vaultProvider';
export { aaveProvider } from './aaveProvider';

export { poolTogetherProvider } from './poolTogetherProvider';
export { morphoProvider } from './morphoProvider';
export { sparkProvider } from './sparkProvider';
export { octantProvider } from './octantProvider';
export { uniswapProvider } from './uniswapProvider';
export { lifiEarnProvider } from './lifiEarnProvider';
export { fhenixVaultProvider } from './fhenixProvider';
