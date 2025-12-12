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

// Stacks ecosystem wallets
export const STACKS_WALLETS = [
    WalletTypes.LEATHER,
    WalletTypes.XVERSE,
    WalletTypes.ASIGNA,
    WalletTypes.FORDEFI
] as const;

export type StacksWalletType = typeof STACKS_WALLETS[number];
