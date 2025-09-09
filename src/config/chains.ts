// Single source of truth for all chain configurations
// Base is the primary lottery chain, others enable cross-chain purchases
export const SUPPORTED_CHAINS = {
  8453: { 
    name: 'Base', 
    native: true, 
    supported: true, 
    icon: '🔵', 
    method: 'Direct Purchase (Primary)',
    purchaseMethod: 'standard' as const,
    description: 'Native Megapot lottery chain'
  },
  43114: { 
    name: 'Avalanche', 
    native: false, 
    supported: true, 
    icon: '🔺', 
    method: 'Cross-chain via NEAR Chain Signatures',
    purchaseMethod: 'cross-chain' as const,
    sourceChain: 'avalanche' as const,
    description: 'Buy Base tickets from Avalanche'
  },
  1: { 
    name: 'Ethereum', 
    native: false, 
    supported: true, 
    icon: '⟠', 
    method: 'Cross-chain via NEAR Chain Signatures',
    purchaseMethod: 'cross-chain' as const,
    sourceChain: 'ethereum' as const,
    description: 'Buy Base tickets from Ethereum'
  },
  137: { 
    name: 'Polygon', 
    native: false, 
    supported: true, 
    icon: '🟣', 
    method: 'Cross-chain via NEAR Chain Signatures',
    purchaseMethod: 'cross-chain' as const,
    sourceChain: 'polygon' as const,
    description: 'Buy Base tickets from Polygon'
  },
  // Solana handled separately via Web3Auth + NEAR Chain Signatures
  'solana': {
    name: 'Solana',
    native: false,
    supported: true,
    icon: '⚫',
    method: 'Cross-chain via NEAR + SNS Integration',
    purchaseMethod: 'cross-chain' as const,
    sourceChain: 'solana' as const,
    description: 'Buy Base tickets from Solana with .sol domains'
  },
} as const;

export type ChainId = keyof typeof SUPPORTED_CHAINS;
export type PurchaseMethod = typeof SUPPORTED_CHAINS[ChainId]['purchaseMethod'];
export type SourceChain = 'avalanche' | 'ethereum' | 'polygon' | 'solana';

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
