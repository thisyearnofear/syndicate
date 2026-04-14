/**
 * CENTRALIZED CONTRACT CONFIGURATION - MEGAPOT V2
 *
 * Core Principles Applied:
 * - DRY: Single source of truth for all contract addresses and ABIs
 * - ORGANIZED: Domain-driven structure with clear categorization
 * - CLEAN: Type-safe with full Viem support
 *
 * Megapot V2 Contracts (Base Mainnet):
 * Deployed: March 2026
 * New Features: LP pooling, cross-chain bridge claims, auto-subscriptions, batch purchases
 */

import { Address, erc20Abi } from 'viem';

// =============================================================================
// CHAIN IDS
// =============================================================================

export const CHAIN_IDS = {
  BASE: 8453,
  BASE_SEPOLIA: 84532,
  ETHEREUM: 1,
  SEPOLIA: 11155111,
  AVALANCHE: 43114,
  STACKS: 12345,
} as const;

// =============================================================================
// MEGAPOT V2 CONTRACTS (Base Mainnet)
// =============================================================================

export const MEGAPOT_V2 = {
  // Main lottery orchestrator
  jackpot: {
    address: '0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2' as Address,
    chainId: CHAIN_IDS.BASE,
    description: 'Main lottery orchestrator - ticket purchases, claims, LP management',
  },

  // LP deposit and share management
  lpManager: {
    address: '0xE63E54DF82d894396B885CE498F828f2454d9dCf' as Address,
    chainId: CHAIN_IDS.BASE,
    description: 'Backer deposit and share management - LP pooling, yield distribution',
  },

  // ERC-721 ticket NFTs
  ticketNFT: {
    address: '0x48FfE35AbB9f4780a4f1775C2Ce1c46185b366e4' as Address,
    chainId: CHAIN_IDS.BASE,
    description: 'ERC-721 ticket NFTs - ticket ownership, metadata, transfers',
  },

  // Auto-subscription management
  autoSubscription: {
    address: '0x02A58B725116BA687D9356Eafe0fA771d58a37ac' as Address,
    chainId: CHAIN_IDS.BASE,
    description: 'Auto-subscription management - recurring ticket purchases',
  },

  // Batch ticket purchases
  batchPurchase: {
    address: '0x01774B531591b286b9f02C6Bc02ab3fD9526Aa76' as Address,
    chainId: CHAIN_IDS.BASE,
    description: 'Batch ticket purchases - buy multiple tickets efficiently',
  },

  // Random ticket generation
  randomTicketBuyer: {
    address: '0xb9560b43b91dE2c1DaF5dfbb76b2CFcDaFc13aBd' as Address,
    chainId: CHAIN_IDS.BASE,
    description: 'Random ticket generation - buy tickets with random numbers',
  },

  // Prize tier calculations
  payoutCalculator: {
    address: '0x97a22361b6208aC8cd9afaea09D20feC47046CBD' as Address,
    chainId: CHAIN_IDS.BASE,
    description: 'Prize tier calculations - guaranteed minimum payouts',
  },

  // Pyth randomness integration
  entropyProvider: {
    address: '0x5D030DEC2e0d38935e662C0d2feD44B050c8Ae51' as Address,
    chainId: CHAIN_IDS.BASE,
    description: 'Pyth randomness integration - provably fair drawings',
  },

  // Cross-chain bridge claims
  bridgeManager: {
    address: '0x0000000000000000000000000000000000000000' as Address, // TODO: Update when deployed
    chainId: CHAIN_IDS.BASE,
    description: 'Cross-chain bridge claims - claim winnings from other chains',
  },
} as const;

// =============================================================================
// TOKEN CONTRACTS
// =============================================================================

export const TOKENS = {
  // USDC on Base
  usdc: {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    chainId: CHAIN_IDS.BASE,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
    abi: erc20Abi,
  },

  // USDC on Base Sepolia (testnet)
  usdcTestnet: {
    address: '0x036CbD53842c5426634E7929541eC2318f3dCd01' as Address,
    chainId: CHAIN_IDS.BASE_SEPOLIA,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin (Testnet)',
    abi: erc20Abi,
  },

  // MPUSDC (Megapot testnet token)
  mpusdc: {
    address: '0xA4253E7C13525287C56550b8708100f93E60509f' as Address,
    chainId: CHAIN_IDS.BASE_SEPOLIA,
    decimals: 6,
    symbol: 'MPUSDC',
    name: 'Megapot Test USDC',
    abi: erc20Abi,
  },
} as const;

// =============================================================================
// CONTRACT ABIS
// =============================================================================

export const MEGAPOT_ABI = [
  // View functions
  {
    name: 'currentDrawingId',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getDrawingState',
    type: 'function',
    inputs: [{ name: 'drawingId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'prizePool', type: 'uint256' },
          { name: 'ticketPrice', type: 'uint256' },
          { name: 'edgePerTicket', type: 'uint256' },
          { name: 'referralWinShare', type: 'uint256' },
          { name: 'referralFee', type: 'uint256' },
          { name: 'globalTicketsBought', type: 'uint256' },
          { name: 'lpEarnings', type: 'uint256' },
          { name: 'drawingTime', type: 'uint256' },
          { name: 'winningTicket', type: 'uint256' },
          { name: 'ballMax', type: 'uint8' },
          { name: 'bonusballMax', type: 'uint8' },
          { name: 'payoutCalculator', type: 'address' },
          { name: 'jackpotLock', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'ticketPrice',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'referralFees',
    type: 'function',
    inputs: [{ name: 'referrer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    name: 'buyTickets',
    type: 'function',
    inputs: [
      {
        name: 'tickets',
        type: 'tuple[]',
        components: [
          { name: 'normals', type: 'uint8[]' },
          { name: 'bonusball', type: 'uint8' },
        ],
      },
      { name: 'recipient', type: 'address' },
      { name: 'referrers', type: 'address[]' },
      { name: 'referralSplit', type: 'uint256[]' },
      { name: 'source', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'claimWinnings',
    type: 'function',
    inputs: [{ name: 'ticketIds', type: 'uint256[]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // LP functions
  {
    name: 'lpDeposit',
    type: 'function',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'initiateWithdraw',
    type: 'function',
    inputs: [{ name: 'shareAmount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'finalizeWithdraw',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    name: 'TicketsPurchased',
    type: 'event',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'ticketIds', type: 'uint256[]' },
      { name: 'totalCost', type: 'uint256' },
    ],
  },
  {
    name: 'WinningsClaimed',
    type: 'event',
    inputs: [
      { name: 'winner', type: 'address', indexed: true },
      { name: 'ticketId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256' },
    ],
  },
] as const;

// =============================================================================
// MEGAPOT V2 CONTRACT EXPORTS
// =============================================================================

export const MEGAPOT_V2_CONTRACTS = {
  ...MEGAPOT_V2,
  abi: MEGAPOT_ABI,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get contract address for current chain
 */
export function getMegapotContract(chainId: number = CHAIN_IDS.BASE): typeof MEGAPOT_V2_CONTRACTS.jackpot {
  const contracts = Object.values(MEGAPOT_V2).filter(c => c.chainId === chainId);
  if (contracts.length === 0) {
    // Default to mainnet
    return MEGAPOT_V2_CONTRACTS.jackpot;
  }
  return contracts[0] as typeof MEGAPOT_V2_CONTRACTS.jackpot;
}

/**
 * Check if chain is supported
 */
export function isSupportedChain(chainId: number): boolean {
  return (Object.values(CHAIN_IDS) as number[]).includes(chainId);
}

// =============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// =============================================================================

/** @deprecated Use MEGAPOT_V2_CONTRACTS.jackpot instead */
export const MEGAPOT = MEGAPOT_V2_CONTRACTS.jackpot;

/** @deprecated Use MEGAPOT_V2_CONTRACTS directly */
export const CONTRACTS = {
  megapot: MEGAPOT_V2_CONTRACTS.jackpot,
  ...MEGAPOT_V2,
};

// Default export
export default MEGAPOT_V2_CONTRACTS;
