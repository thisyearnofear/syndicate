/**
 * UNIFIED CONFIGURATION SYSTEM
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for all configuration
 * - CLEAN: Clear separation of concerns by domain
 * - MODULAR: Composable configuration modules
 * - ORGANIZED: Domain-driven structure
 */

import { sepolia, base, avalanche, mainnet, baseSepolia } from "viem/chains";
import { CCTP } from './cctpConfig';
import { CCIP } from './ccipConfig';

// =============================================================================
// BLOCKCHAIN CONFIGURATION
// =============================================================================

export const CHAINS = {
  base: {
    ...base,
    name: "Base",
    explorerUrl: "https://basescan.org",
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/zXTB8midlluEtdL8Gay5bvz5RI-FfsDH",
    pimlicoRpcUrl: process.env.NEXT_PUBLIC_PIMLICO_BASE_RPC || "https://api.pimlico.io/v2/8453/rpc?apikey=pim_JppWZ3Cupeq1sG3SJ4fLTa",
  },
  tenderlyFork: {
    id: 8,
    name: "Tenderly Mainnet Fork",
    network: "tenderly-mainnet-fork",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: process.env.NEXT_PUBLIC_TENDERLY_MAINNET_FORK_RPC || "https://virtual.mainnet.eu.rpc.tenderly.co/82c86106-662e-4d7f-a974-c311987358ff",
    explorerUrl: "",
  },
  avalanche: {
    ...avalanche,
    name: "Avalanche",
    explorerUrl: "https://snowtrace.io",
    rpcUrl: process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || "https://api.pimlico.io/v2/43114/rpc?apikey=pim_JppWZ3Cupeq1sG3SJ4fLTa",
    pimlicoRpcUrl: process.env.NEXT_PUBLIC_PIMLICO_AVALANCHE_RPC || "https://api.pimlico.io/v2/43114/rpc?apikey=pim_JppWZ3Cupeq1sG3SJ4fLTa",
  },
  ethereum: {
    ...mainnet,
    name: "Ethereum",
    explorerUrl: "https://etherscan.io",
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || "https://mainnet.infura.io/v3/119d623be6f144138f75b5af8babdda4",
  },
  sepolia: {
    ...sepolia,
    name: "Sepolia Testnet",
    explorerUrl: "https://sepolia.etherscan.io",
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/119d623be6f144138f75b5af8babdda4",
  },
  baseSepolia: {
    ...baseSepolia,
    name: "Base Sepolia",
    explorerUrl: "https://sepolia.basescan.org",
    rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  },
  stacks: {
    id: 12345,
    name: "Stacks",
    network: "stacks-mainnet",
    nativeCurrency: { name: "Stacks", symbol: "STX", decimals: 6 },
    rpcUrl: process.env.NEXT_PUBLIC_STACKS_RPC_URL || "https://api.mainnet.hiro.so",
    explorerUrl: "https://explorer.stacks.co",
    pimlicoRpcUrl: process.env.NEXT_PUBLIC_PIMLICO_STACKS_RPC || "https://api.pimlico.io/v2/12345/rpc",
  },
} as const;

export const CHAIN_IDS = {
  BASE: 8453,
  BASE_SEPOLIA: 84532,
  AVALANCHE: 43114,
  ETHEREUM: 1,
  SEPOLIA: 11155111,
  STACKS: 12345,
} as const;

// Default chain for development
export const DEFAULT_CHAIN = CHAINS.base;

// =============================================================================
// CONTRACT CONFIGURATION
// =============================================================================

/**
 * Megapot contract addresses by chain
 * Testnet (Base Sepolia): 0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De with mock MPUSDC
 * Prod (Base Mainnet): 0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95 with real USDC
 */
const MEGAPOT_BY_CHAIN: Record<number, `0x${string}`> = {
  [CHAIN_IDS.BASE]: '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95',           // Base mainnet (prod)
  [CHAIN_IDS.BASE_SEPOLIA]: '0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De',   // Base Sepolia (testnet)
};

const USDC_BY_CHAIN: Record<number, `0x${string}`> = {
  [CHAIN_IDS.BASE]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',           // Base mainnet USDC.e
  [CHAIN_IDS.BASE_SEPOLIA]: '0x036CbD53842c5426634E7929541eC2318f3dCd01',   // Base Sepolia testnet USDC
  [CHAIN_IDS.ETHEREUM]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',       // Ethereum mainnet USDC
  [CHAIN_IDS.SEPOLIA]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',       // Ethereum Sepolia testnet USDC
};

export const CONTRACTS = {
  // Megapot lottery contract - chain-aware with env override
  megapot: process.env.NEXT_PUBLIC_MEGAPOT_CONTRACT || "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95",

  // Syndicate coordination contract
  syndicate: process.env.NEXT_PUBLIC_SYNDICATE_CONTRACT || "0x0000000000000000000000000000000000000000",

  // Cause-based distribution contract
  causeFund: process.env.NEXT_PUBLIC_CAUSE_FUND_CONTRACT || "0x0000000000000000000000000000000000000000",

  // Vault strategy contracts
  vaultStrategies: {
    spark: process.env.NEXT_PUBLIC_SPARK_VAULT || "0x0000000000000000000000000000000000000000",
    morpho: process.env.NEXT_PUBLIC_MORPHO_VAULT || "0x0000000000000000000000000000000000000000",
    aave: process.env.NEXT_PUBLIC_AAVE_VAULT || "0x0000000000000000000000000000000000000000",
    uniswap: process.env.NEXT_PUBLIC_UNISWAP_VAULT || "0x0000000000000000000000000000000000000000",
    octant: process.env.NEXT_PUBLIC_OCTANT_VAULT || "0x0000000000000000000000000000000000000000",
  },

  // USDC token on Base
  usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
} as const;

/**
 * Get Megapot contract address for current chain
 */
export function getMegapotAddressForChain(chainId: number): `0x${string}` {
  return MEGAPOT_BY_CHAIN[chainId] || CONTRACTS.megapot as `0x${string}`;
}

/**
 * Get USDC contract address for current chain
 */
export function getUsdcAddressForChain(chainId: number): `0x${string}` {
  return USDC_BY_CHAIN[chainId] || CONTRACTS.usdc as `0x${string}`;
}

// Contract events
export const CONTRACT_EVENTS = {
  startBlock: 27077440,
  purchaseTicketTopic: "0xd72c70202ab87b3549553b1d4ceb2a632c83cb96fa2dfe65c30282862fe11ade",
  jackpotRunTopic: "0x3208da215cdfa0c44cf3d81565b27f57d4c505bf1a48e40957e53aaf3ba2aa82",
} as const;

// =============================================================================

// LOTTERY CONFIGURATION

// =============================================================================



export const LOTTERY = {
  ticketPriceUsd: 1, // $1 per ticket
  ticketPriceWei: BigInt(1 * 10 ** 6), // 1 USDC in wei (6 decimals)
  referrerAddress: process.env.NEXT_PUBLIC_REFERRER_ADDRESS || "0x0000000000000000000000000000000000000000",
} as const;



// =============================================================================

// API CONFIGURATION

// =============================================================================



export const API = {
  megapot: {
    baseUrl: "https://api.megapot.io/api/v1",
    apiKey: process.env.NEXT_PUBLIC_MEGAPOT_API_KEY,
    endpoints: {
      jackpotStats: "/jackpot-round-stats/active",
      ticketPurchases: "/ticket-purchases",
      dailyGiveaway: "/giveaways/daily-giveaway-winners",
    },
  },
  stacks: {
    baseUrl: process.env.NEXT_PUBLIC_STACKS_API_URL || "https://api.mainnet.hiro.so",
    apiKey: process.env.NEXT_PUBLIC_STACKS_API_KEY,
    endpoints: {
      jackpotStats: "/lottery/jackpot-round-stats/active",
      ticketPurchases: "/lottery/ticket-purchases",
      dailyGiveaway: "/lottery/daily-giveaway-winners",
    },
  },
} as const;



// =============================================================================

// DESIGN SYSTEM

// =============================================================================



export const DESIGN = {

  colors: {

    primary: "#4F46E5", // indigo-600

    secondary: "#10B981", // emerald-500

    background: "#111827", // gray-900

    surface: "#1F2937", // gray-800

    textPrimary: "#F9FAFB", // gray-50

    textSecondary: "#D1D5DB", // gray-300

    error: "#EF4444", // red-500

    warning: "#F59E0B", // amber-500

    success: "#10B981", // emerald-500

    accent: "#8B5CF6", // purple-500

  },

  spacing: {

    xs: "4px",

    sm: "8px",

    md: "16px",

    lg: "24px",

    xl: "32px",

  },

  borderRadius: {

    sm: "4px",

    md: "8px",

    lg: "12px",

    full: "9999px",

  },

  fontSize: {

    xs: "0.75rem",

    sm: "0.875rem",

    base: "1rem",

    lg: "1.125rem",

    xl: "1.25rem",

    "2xl": "1.5rem",

    "3xl": "1.875rem",

  },

  animation: {

    duration: 0.3, // Duration in seconds for micro-animations

  },

} as const;



// =============================================================================

// PERFORMANCE & BRIDGE CONFIGURATION

// =============================================================================



export const PERFORMANCE = {

  // Cache durations in milliseconds

  cache: {

    jackpotData: 300000, // 5 minutes

    activityFeed: 60000, // 1 minute

    syndicateData: 300000, // 5 minutes

  },

  // Request timeouts

  timeouts: {

    api: 30000, // 30 seconds

    blockchain: 60000, // 1 minute

  },

  // Pagination limits

  pagination: {

    activityFeed: 20,

    syndicates: 50,

    transactions: 100,

  },

} as const;



// =============================================================================

// BRIDGE CONFIGURATION (Solana → Base)

// =============================================================================



export const BRIDGE = {

  // RPC Configuration

  rpc: {

    primaryUrl: process.env.NEXT_PUBLIC_SOLANA_RPC || "https://rpc.ankr.com/solana",

    fallbackUrls: (process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS || "https://solana-api.projectserum.com")

      .split(",")

      .map((url) => url.trim())

      .filter(Boolean),

  },



  // Connection timeouts & retries

  connection: {

    timeoutMs: parseInt(process.env.NEXT_PUBLIC_BRIDGE_CONNECTION_TIMEOUT_MS || "5000"),

    maxAttempts: 3,

    backoffMultiplier: 1.5,

  },



  // Transaction confirmation

  confirmation: {

    timeoutMs: parseInt(process.env.NEXT_PUBLIC_BRIDGE_CONFIRM_TIMEOUT_MS || "180000"), // 3 minutes

    initialDelayMs: 1500,

    maxDelayMs: 5000,

  },



  // Attestation polling (Circle CCTP)

  attestation: {

    timeoutMs: parseInt(process.env.NEXT_PUBLIC_BRIDGE_ATTESTATION_TIMEOUT_MS || "120000"), // 2 minutes

    initialDelayMs: 2000,

    maxDelayMs: 10000,

    backoffMultiplier: 1.5,

  },



  // RPC health checking

  health: {

    checkIntervalMs: 60000, // Check RPC health every 60 seconds

    failureThreshold: 3, // Open circuit after 3 failures

    resetTimeMs: 60000, // Reset circuit after 60 seconds of no failures

  },



  // Protocol selection

  protocols: {

    primary: "cctp" as const, // CCTP for native USDC

    fallback: "wormhole" as const, // Wormhole fallback (not yet implemented)

  },

} as const;



// =============================================================================

// FEATURE FLAGS

// =============================================================================



export const FEATURES = {

  enableRealTimeUpdates: process.env.NEXT_PUBLIC_ENABLE_REALTIME === "true",

  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",

  enableDebugMode: process.env.NODE_ENV === "development",

  enableMockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true",

  enableERC7715SmartSessions: process.env.NEXT_PUBLIC_ENABLE_ERC7715_SESSIONS === "true",

} as const;



// =============================================================================

// EXPORTS FOR BACKWARD COMPATIBILITY

// =============================================================================



import { getNearConfig } from './nearConfig';



// Legacy exports - will be removed in future versions

export const SUPPORTED_CHAINS = CHAINS;

export const config = {

  chain: DEFAULT_CHAIN,

  ethScanerUrl: DEFAULT_CHAIN.explorerUrl,

  contracts: CONTRACTS,

  near: getNearConfig(),

};



// Modern exports

export { CHAINS as chains };

export { CONTRACTS as contracts };

export { LOTTERY as lottery };

export { DESIGN as design };

export { API as api };

export { PERFORMANCE as performance };

export { BRIDGE as bridge };

export { FEATURES as features };

export { CCTP as cctp };

export { CCIP as ccip };

export * from './nearConfig';



// Type exports

export type ChainConfig = typeof CHAINS[keyof typeof CHAINS];

export type ChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];

export type ContractAddress = typeof CONTRACTS[keyof typeof CONTRACTS];