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
