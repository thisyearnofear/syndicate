/**
 * VAULT PROVIDER INTERFACE
 * 
 * Core Principles Applied:
 * - MODULAR: Composable vault providers
 * - CLEAN: Clear interface for all vault protocols
 * - DRY: Single interface for Aave, Morpho, Spark
 * 
 * Phase 2: Week 1-2 Foundation
 */

import type { TransactionResponse } from 'ethers';

export type VaultProtocol = 'aave' | 'morpho' | 'spark';

export interface VaultBalance {
    deposited: string; // USDC amount deposited
    yieldAccrued: string; // USDC yield earned
    totalBalance: string; // deposited + yieldAccrued
    apy: number; // Annual percentage yield
    lastUpdated: number; // Timestamp
}

export interface VaultDepositResult {
    success: boolean;
    txHash?: string;
    error?: string;
    vaultId?: string;
}

export interface VaultWithdrawResult {
    success: boolean;
    txHash?: string;
    error?: string;
    amountWithdrawn?: string;
}

/**
 * Abstract interface for vault providers
 * Implementations: AaveProvider, MorphoProvider, SparkProvider
 */
export interface VaultProvider {
    /** Protocol identifier */
    readonly name: VaultProtocol;

    /** Chain ID where this vault operates */
    readonly chainId: number;

    /**
     * Get user's balance in the vault
     * @param userAddress - User's wallet address
     * @returns Balance information including yield
     */
    getBalance(userAddress: string): Promise<VaultBalance>;

    /**
     * Get yield accrued since last update
     * @param userAddress - User's wallet address
     * @returns USDC amount of yield earned
     */
    getYieldAccrued(userAddress: string): Promise<string>;

    /**
     * Deposit USDC into the vault
     * @param amount - USDC amount to deposit (in human-readable format, e.g., "100.50")
     * @param userAddress - User's wallet address
     * @returns Transaction result
     */
    deposit(amount: string, userAddress: string): Promise<VaultDepositResult>;

    /**
     * Withdraw USDC from the vault
     * @param amount - USDC amount to withdraw (in human-readable format)
     * @param userAddress - User's wallet address
     * @returns Transaction result
     */
    withdraw(amount: string, userAddress: string): Promise<VaultWithdrawResult>;

    /**
     * Withdraw only the yield (keep principal)
     * @param userAddress - User's wallet address
     * @returns Transaction result
     */
    withdrawYield(userAddress: string): Promise<VaultWithdrawResult>;

    /**
     * Check if the vault is healthy and operational
     * @returns true if vault is operational
     */
    isHealthy(): Promise<boolean>;

    /**
     * Get current APY for the vault
     * @returns Annual percentage yield as a number (e.g., 5.25 for 5.25%)
     */
    getCurrentAPY(): Promise<number>;
}

/**
 * Vault provider factory configuration
 */
export interface VaultProviderConfig {
    protocol: VaultProtocol;
    chainId: number;
    rpcUrl?: string;
    contractAddress?: string;
}

/**
 * Error types for vault operations
 */
export class VaultError extends Error {
    constructor(
        message: string,
        public readonly code: VaultErrorCode,
        public readonly protocol: VaultProtocol
    ) {
        super(message);
        this.name = 'VaultError';
    }
}

export enum VaultErrorCode {
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    VAULT_UNHEALTHY = 'VAULT_UNHEALTHY',
    TRANSACTION_FAILED = 'TRANSACTION_FAILED',
    INVALID_AMOUNT = 'INVALID_AMOUNT',
    PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
    NETWORK_ERROR = 'NETWORK_ERROR',
    CONTRACT_ERROR = 'CONTRACT_ERROR',
}
