// Single source of truth for all chain configurations
export const SUPPORTED_CHAINS = {
  8453: { 
    name: 'Base', 
    native: true, 
    supported: true, 
    icon: '🔵', 
    method: 'Direct Purchase',
    purchaseMethod: 'standard' as const
  },
  43114: { 
    name: 'Avalanche', 
    native: false, 
    supported: true, 
    icon: '🔺', 
    method: 'NEAR Chain Signatures',
    purchaseMethod: 'cross-chain' as const,
    sourceChain: 'avalanche' as const
  },
  1: { 
    name: 'Ethereum', 
    native: false, 
    supported: true, 
    icon: '⟠', 
    method: 'NEAR Chain Signatures',
    purchaseMethod: 'cross-chain' as const,
    sourceChain: 'ethereum' as const
  },
  137: { 
    name: 'Polygon', 
    native: false, 
    supported: true, 
    icon: '🟣', 
    method: 'NEAR Chain Signatures',
    purchaseMethod: 'cross-chain' as const,
    sourceChain: 'polygon' as const
  },
} as const;

export type ChainId = keyof typeof SUPPORTED_CHAINS;
export type PurchaseMethod = typeof SUPPORTED_CHAINS[ChainId]['purchaseMethod'];
export type SourceChain = typeof SUPPORTED_CHAINS[ChainId]['sourceChain'];

export const getChainConfig = (chainId: number) => {
  return SUPPORTED_CHAINS[chainId as ChainId] || { 
    name: 'Unsupported', 
    native: false, 
    supported: false, 
    icon: '❓', 
    method: 'Not Available',
    purchaseMethod: 'standard' as const
  };
};
