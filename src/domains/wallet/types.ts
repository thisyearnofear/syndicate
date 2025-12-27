/**
 * WALLET TYPES & ROUTING
 * 
 * Architecture: Single Wallet, Any Chain Origin
 * - User connects ONE native wallet per ecosystem
 * - System auto-routes bridge based on wallet type
 * - No manual wallet switching needed
 * - One button per ecosystem: EVM, SOL, NEAR, Stacks, Social
 * 
 * Routing Table:
 * - EVM (MetaMask/WalletConnect): EVM chains → CCIP/CCTP → Base
 * - SOL (Phantom): Solana → CCTP → Base
 * - STACKS (Leather/Xverse/Asigna/Fordefi): Stacks → sBTC → CCTP → Base
 * - NEAR: NEAR → Chain Signatures (MPC) → Derived Base Address
 * - SOCIAL: Coming soon
 * 
 * ADVANCED PERMISSIONS (ERC-7715):
 * - Supported on MetaMask (EVM) with EIP-7702 enabled chains (Base, Ethereum, Avalanche)
 * - Allows automated ticket purchases with user-granted permissions
 * - User sets limit (e.g., 10 USDC/week) and Syndicate executes purchases automatically
 */

export type WalletType = 'evm' | 'solana' | 'social' | 'near' | 'stacks';

export const WalletTypes = {
    EVM: 'evm' as const,           // MetaMask, WalletConnect, etc.
    SOLANA: 'solana' as const,      // Phantom, etc.
    SOCIAL: 'social' as const,
    NEAR: 'near' as const,
    STACKS: 'stacks' as const,      // Leather, Xverse, Asigna, Fordefi, etc.
};

/**
 * All Stacks ecosystem wallets use the same connection interface
 * @stacks/connect auto-detects available wallet and handles connection
 */
export const STACKS_WALLETS = [WalletTypes.STACKS] as const;

export type StacksWalletType = typeof STACKS_WALLETS[number];

/**
 * Get wallet routing information
 * DRY: Single source for all wallet routing logic
 */
export function getWalletRouting(walletType: WalletType): {
    nativeChain: string;
    bridgeProtocol: string;
    destination: string;
    description: string;
} {
    switch (walletType) {
        case WalletTypes.EVM:
            return {
                nativeChain: 'EVM (any)',
                bridgeProtocol: 'CCIP/CCTP',
                destination: 'Base',
                description: 'Auto-selected based on origin chain'
            };
        case WalletTypes.SOLANA:
            return {
                nativeChain: 'Solana',
                bridgeProtocol: 'CCTP',
                destination: 'Base',
                description: 'Circle Cross-Chain Transfer Protocol'
            };
        case WalletTypes.STACKS:
            return {
                nativeChain: 'Stacks (Bitcoin L2)',
                bridgeProtocol: 'sBTC → CCTP',
                destination: 'Base',
                description: 'Bitcoin-backed sBTC bridged via Circle'
            };
        case WalletTypes.NEAR:
            return {
                nativeChain: 'NEAR',
                bridgeProtocol: 'Chain Signatures',
                destination: 'Base (Derived)',
                description: 'MPC-derived account, no storage needed'
            };
        case WalletTypes.SOCIAL:
            return {
                nativeChain: 'TBD',
                bridgeProtocol: 'TBD',
                destination: 'Base',
                description: 'Social login (coming soon)'
            };
        default:
            return {
                nativeChain: 'Unknown',
                bridgeProtocol: 'Unknown',
                destination: 'Unknown',
                description: 'Unknown wallet type'
            };
    }
}

// =============================================================================
// ADVANCED PERMISSIONS (ERC-7715) TYPES
// =============================================================================

/**
 * Represents a granted Advanced Permission for automated actions
 * CLEAN: Single source of truth for permission state
 */
export interface AdvancedPermission {
    /** Unique permission identifier from MetaMask */
    permissionId: string;
    
    /** Permission scope (e.g., "erc20:spend") */
    scope: 'erc20:spend' | 'native:spend';
    
    /** Token address (for ERC-20 permissions) or null for native */
    token: string | null;
    
    /** Spender address (Syndicate contract) */
    spender: string;
    
    /** Total limit across all periods */
    limit: bigint;
    
    /** Current remaining allowance */
    remaining: bigint;
    
    /** Time period for limit reset (e.g., 'weekly') */
    period: 'daily' | 'weekly' | 'monthly' | 'unlimited';
    
    /** Timestamp when permission was granted */
    grantedAt: number;
    
    /** Timestamp when permission expires (null = no expiry) */
    expiresAt: number | null;
    
    /** Whether permission is currently active */
    isActive: boolean;
}

/**
 * Configuration for requesting a new Advanced Permission
 */
export interface PermissionRequest {
    /** Permission scope */
    scope: 'erc20:spend' | 'native:spend';
    
    /** Target token address (required for ERC-20) */
    tokenAddress?: string;
    
    /** Total limit user is granting */
    limit: bigint;
    
    /** Time period (e.g., 'weekly' for recurring limits) */
    period: 'daily' | 'weekly' | 'monthly' | 'unlimited';
    
    /** Human-readable description for user approval */
    description: string;
}

/**
 * Result of requesting Advanced Permissions from user
 */
export interface PermissionResult {
    success: boolean;
    permission?: AdvancedPermission;
    error?: string;
}

/**
 * Automated purchase configuration using Advanced Permissions
 * CLEAN: Represents the contract between app and user for auto-purchases
 */
export interface AutoPurchaseConfig {
    /** Whether auto-purchase is enabled */
    enabled: boolean;
    
    /** Permission granted to Syndicate */
    permission?: AdvancedPermission;
    
    /** Frequency of automatic purchases */
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    
    /** Amount to spend per period */
    amountPerPeriod: bigint;
    
    /** Token to spend (USDC address on Base) */
    tokenAddress: string;
    
    /** Last execution timestamp */
    lastExecuted?: number;
    
    /** Next scheduled execution */
    nextExecution?: number;
}
