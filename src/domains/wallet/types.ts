/**
 * WALLET TYPES & ROUTING
 * 
 * Architecture: Single Wallet, Any Chain Origin
 * - User connects ONE native wallet
 * - System auto-routes bridge based on wallet type
 * - No manual wallet switching needed
 * 
 * Routing Table:
 * - MetaMask/WalletConnect: EVM chains → CCIP/CCTP → Base
 * - Phantom: Solana → CCTP → Base
 * - Leather/Xverse/Asigna/Fordefi: Stacks → sBTC → CCTP → Base
 * - NEAR: NEAR → Chain Signatures (MPC) → Derived Base Address
 * - Social: Coming soon
 */

export type WalletType = 'metamask' | 'phantom' | 'social' | 'near' | 'leather' | 'xverse' | 'asigna' | 'fordefi';

export const WalletTypes = {
    METAMASK: 'metamask' as const,
    PHANTOM: 'phantom' as const,
    SOCIAL: 'social' as const,
    NEAR: 'near' as const,
    LEATHER: 'leather' as const,
    XVERSE: 'xverse' as const,
    ASIGNA: 'asigna' as const,
    FORDEFI: 'fordefi' as const,
};

/**
 * Stacks ecosystem wallets (Bitcoin Layer 2)
 * All route through sBTC → CCTP → Base
 */
export const STACKS_WALLETS = [
    WalletTypes.LEATHER,
    WalletTypes.XVERSE,
    WalletTypes.ASIGNA,
    WalletTypes.FORDEFI
] as const;

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
        case WalletTypes.METAMASK:
            return {
                nativeChain: 'EVM (any)',
                bridgeProtocol: 'CCIP/CCTP',
                destination: 'Base',
                description: 'Auto-selected based on origin chain'
            };
        case WalletTypes.PHANTOM:
            return {
                nativeChain: 'Solana',
                bridgeProtocol: 'CCTP',
                destination: 'Base',
                description: 'Circle Cross-Chain Transfer Protocol'
            };
        case WalletTypes.LEATHER:
        case WalletTypes.XVERSE:
        case WalletTypes.ASIGNA:
        case WalletTypes.FORDEFI:
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
