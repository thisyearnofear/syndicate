/**
 * WALLET CHAIN CONSTANTS
 * 
 * DRY: Single source of truth for all chain IDs and wallet-chain mappings
 * CLEAN: Eliminates magic numbers throughout the codebase
 * ORGANIZED: Domain-driven organization with wallet constants
 */

// =============================================================================
// CHAIN ID CONSTANTS
// =============================================================================

/** EVM Chain IDs */
export const CHAIN_IDS = {
  // EVM Chains
  ETHEREUM: 1,
  BASE: 8453,
  BASE_SEPOLIA: 84532,
  POLYGON: 137,
  AVALANCHE: 43114,
  
  // Non-EVM (use string keys for semantic clarity)
  SOLANA: 'solana',
  STACKS: 'stacks',
  NEAR: 'near',
} as const;

export type ChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];

/**
 * Determine if a chain ID is an EVM chain (numeric)
 */
export function isEvmChain(chainId: ChainId | number | string): chainId is number {
  return typeof chainId === 'number';
}

/**
 * Determine if a chain ID is a non-EVM chain (string)
 */
export function isNonEvmChain(chainId: ChainId | number | string): chainId is string {
  return typeof chainId === 'string';
}

// =============================================================================
// WALLET-CHAIN MAPPING
// =============================================================================

/**
 * Maps wallet types to their native chains
 * CLEAN: Single source for understanding which chains each wallet supports
 */
export const WALLET_NATIVE_CHAINS = {
  evm: [CHAIN_IDS.ETHEREUM, CHAIN_IDS.POLYGON, CHAIN_IDS.AVALANCHE, CHAIN_IDS.BASE] as const,
  solana: [CHAIN_IDS.SOLANA] as const,
  stacks: [CHAIN_IDS.STACKS] as const,
  near: [CHAIN_IDS.NEAR] as const,
  social: [] as const, // TBD
} as const;

/**
 * Check if a wallet can operate on a given chain
 */
export function canWalletOperateOnChain(
  walletType: 'evm' | 'solana' | 'stacks' | 'near' | 'social',
  chainId: ChainId | number | string
): boolean {
  const nativeChains = WALLET_NATIVE_CHAINS[walletType];
  return nativeChains.includes(chainId as any);
}

// =============================================================================
// SOLANA CHAIN ID
// =============================================================================

/**
 * Special handling: Solana doesn't use numeric chain IDs
 * Use this constant for consistency
 */
export const SOLANA_CHAIN_ID = CHAIN_IDS.SOLANA;

/**
 * Check if chainId represents Solana
 */
export function isSolanaChain(chainId: ChainId | number | string): boolean {
  return chainId === CHAIN_IDS.SOLANA || chainId === 'solana';
}
