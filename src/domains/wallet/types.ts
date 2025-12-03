export type WalletType = 'metamask' | 'phantom' | 'social' | 'near';

export const WalletTypes = {
    METAMASK: 'metamask' as const,
    PHANTOM: 'phantom' as const,
    SOCIAL: 'social' as const,
    NEAR: 'near' as const,
};
