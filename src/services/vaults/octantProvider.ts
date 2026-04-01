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
import { OCTANT_CONFIG } from '@/config/octantConfig';
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

    // Use mock vault address for MVP
    private readonly VAULT_ADDRESS = OCTANT_CONFIG.useMockVault 
        ? 'mock:octant-usdc' 
        : OCTANT_CONFIG.vaults.ethereumUsdcVault;

    async getBalance(userAddress: string): Promise<VaultBalance> {
        try {
            const vaultInfo = await octantVaultService.getVaultInfo(this.VAULT_ADDRESS, userAddress);
            
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
        try {
            // For mock vault, always healthy
            if (OCTANT_CONFIG.useMockVault) return true;
            
            // For real vault, check if we can fetch vault info
            await octantVaultService.getVaultInfo(this.VAULT_ADDRESS);
            return true;
        } catch {
            return false;
        }
    }

    async deposit(amount: string, userAddress: string): Promise<VaultDepositResult> {
        try {
            const result = await octantVaultService.deposit(this.VAULT_ADDRESS, amount, userAddress);
            
            return {
                success: result.success,
                txHash: result.txHash,
                error: result.error,
                vaultId: `octant:${this.VAULT_ADDRESS}`,
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Deposit failed';
            throw new VaultError(msg, VaultErrorCode.TRANSACTION_FAILED, 'octant');
        }
    }

    async withdraw(amount: string, userAddress: string): Promise<VaultWithdrawResult> {
        try {
            const result = await octantVaultService.withdraw(
                this.VAULT_ADDRESS,
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
