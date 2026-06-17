/**
 * OCTANT VAULT PROVIDER
 * 
 * Core Principles Applied:
 * - MODULAR: Isolated Octant integration
 * - CLEAN: Adapter pattern wrapping octantVaultService
 * - DRY: Reuses existing octantVaultService
 * 
 * Octant V2 ERC-4626 vaults with yield donation features
 */

import { octantVaultService } from '../octantVaultService';
import {
    OCTANT_CONFIG,
    isOctantEnabled,
    isOctantMockEnabled,
    resolveOctantVaultAddress,
} from '@/config/octantConfig';
import type {
    VaultProvider,
    VaultProtocol,
    VaultBalance,
    VaultDepositResult,
    VaultWithdrawResult,
} from './vaultProvider';
import { VaultError, VaultErrorCode } from './vaultProvider';

export class OctantVaultProvider implements VaultProvider {
    readonly name: VaultProtocol = 'octant';
    readonly chainId: number = 1; // Ethereum mainnet (or Base for cross-chain)

    private cachedAPY: { value: number; timestamp: number } | null = null;
    private readonly APY_CACHE_TTL = 5 * 60 * 1000;

    /**
     * Active vault address, resolved per-call so env/config changes are
     * picked up. Returns the real configured vault, the mock vault (only when
     * NEXT_PUBLIC_OCTANT_MOCK is set), or null when Octant is disabled.
     */
    private get vaultAddress(): string | null {
        return resolveOctantVaultAddress();
    }

    /**
     * Throw a clear, actionable error when Octant is disabled (no real vault
     * configured and the mock not explicitly enabled). Mirrors the TON pause
     * pattern so the mock never silently runs for real users.
     */
    private assertEnabled(): string {
        const addr = this.vaultAddress;
        if (!addr) {
            throw new VaultError(
                'Octant vault is disabled: configure a real ERC-4626 vault address or set NEXT_PUBLIC_OCTANT_MOCK=true for demos/tests.',
                VaultErrorCode.VAULT_DISABLED,
                'octant',
            );
        }
        return addr;
    }

    async getBalance(userAddress: string): Promise<VaultBalance> {
        // When disabled, report an empty position instead of faking a balance.
        if (!isOctantEnabled()) {
            return {
                deposited: '0',
                yieldAccrued: '0',
                totalBalance: '0',
                apy: 0,
                lastUpdated: Date.now(),
            };
        }
        try {
            const vaultInfo = await octantVaultService.getVaultInfo(this.vaultAddress!, userAddress);
            
            return {
                deposited: vaultInfo.userAssets,
                yieldAccrued: vaultInfo.yieldGenerated,
                totalBalance: vaultInfo.userAssets,
                apy: vaultInfo.apy,
                lastUpdated: Date.now(),
            };
        } catch (error) {
            console.error('[OctantVault] Failed to get balance:', error);
            return {
                deposited: '0',
                yieldAccrued: '0',
                totalBalance: '0',
                apy: 0,
                lastUpdated: Date.now(),
            };
        }
    }

    async getYieldAccrued(userAddress: string): Promise<string> {
        const balance = await this.getBalance(userAddress);
        return balance.yieldAccrued;
    }

    async getCurrentAPY(): Promise<number> {
        // Don't advertise a yield figure for a vault that won't run.
        if (!isOctantEnabled()) return 0;

        if (this.cachedAPY && Date.now() - this.cachedAPY.timestamp < this.APY_CACHE_TTL) {
            return this.cachedAPY.value;
        }

        try {
            const apy = OCTANT_CONFIG.expectedAPY.default;
            this.cachedAPY = { value: apy, timestamp: Date.now() };
            return apy;
        } catch (error) {
            console.error('[OctantVault] Failed to get APY:', error);
            return 0;
        }
    }

    async isHealthy(): Promise<boolean> {
        // Disabled (no real vault, no explicit mock opt-in) → not healthy.
        if (!isOctantEnabled()) return false;
        try {
            // Explicitly-enabled mock vault is always "healthy".
            if (isOctantMockEnabled() && !this.vaultAddress?.startsWith('0x')) return true;

            // For real vault, check if we can fetch vault info
            await octantVaultService.getVaultInfo(this.vaultAddress!);
            return true;
        } catch {
            return false;
        }
    }

    async deposit(amount: string, userAddress: string): Promise<VaultDepositResult> {
        const vaultAddr = this.assertEnabled();
        try {
            const result = await octantVaultService.deposit(vaultAddr, amount, userAddress);

            return {
                success: result.success,
                txHash: result.txHash,
                error: result.error,
                vaultId: `octant:${vaultAddr}`,
            };
        } catch (error) {
            if (error instanceof VaultError) throw error;
            const msg = error instanceof Error ? error.message : 'Deposit failed';
            throw new VaultError(msg, VaultErrorCode.TRANSACTION_FAILED, 'octant');
        }
    }

    async withdraw(amount: string, userAddress: string): Promise<VaultWithdrawResult> {
        const vaultAddr = this.assertEnabled();
        try {
            const result = await octantVaultService.withdraw(
                vaultAddr,
                amount,
                userAddress,
                userAddress
            );

            return {
                success: result.success,
                txHash: result.txHash,
                error: result.error,
                amountWithdrawn: result.assets,
            };
        } catch (error) {
            if (error instanceof VaultError) throw error;
            const msg = error instanceof Error ? error.message : 'Withdrawal failed';
            throw new VaultError(msg, VaultErrorCode.TRANSACTION_FAILED, 'octant');
        }
    }

    async withdrawYield(userAddress: string): Promise<VaultWithdrawResult> {
        const yieldAmount = await this.getYieldAccrued(userAddress);
        const yieldNum = parseFloat(yieldAmount);
        
        if (yieldNum <= 0) {
            return { success: false, error: 'No yield available to withdraw' };
        }

        return this.withdraw(yieldAmount, userAddress);
    }
}

export const octantProvider = new OctantVaultProvider();
