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
} as const;

export const CHAIN_IDS = {
  BASE: 8453,
  BASE_SEPOLIA: 84532,
  AVALANCHE: 43114,
  ETHEREUM: 1,
  SEPOLIA: 11155111,
} as const;

// Default chain for development
export const DEFAULT_CHAIN = CHAINS.base;

// =============================================================================
// CONTRACT CONFIGURATION
// =============================================================================

export const CONTRACTS = {
  // Megapot lottery contract on Base
  megapot: process.env.NEXT_PUBLIC_MEGAPOT_CONTRACT || "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95",
  
  // Syndicate coordination contract
  syndicate: process.env.NEXT_PUBLIC_SYNDICATE_CONTRACT || "0x0000000000000000000000000000000000000000",
  
  // Cause-based distribution contract
  causeFund: process.env.NEXT_PUBLIC_CAUSE_FUND_CONTRACT || "0x0000000000000000000000000000000000000000",
  
  // USDC token on Base
  usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
} as const;

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
// NEAR CONFIGURATION (for chain signatures)
// =============================================================================

export const NEAR = {
  networkId: process.env.NEXT_PUBLIC_NEAR_NETWORK_ID || "mainnet",
  nodeUrl: process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.mainnet.near.org",
  walletUrl: process.env.NEXT_PUBLIC_NEAR_WALLET_URL || "https://wallet.mainnet.near.org",
  helperUrl: process.env.NEXT_PUBLIC_NEAR_HELPER_URL || "https://helper.mainnet.near.org",
  mpcContract: "v1.signer", // Real NEAR Chain Signatures contract
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
// PERFORMANCE CONFIGURATION
// =============================================================================

export const PERFORMANCE = {
  // Cache durations in milliseconds
  cache: {
    jackpotData: 30000, // 30 seconds
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
// FEATURE FLAGS
// =============================================================================

export const FEATURES = {
  enableRealTimeUpdates: process.env.NEXT_PUBLIC_ENABLE_REALTIME === "true",
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",
  enableDebugMode: process.env.NODE_ENV === "development",
  enableMockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true",
} as const;

// =============================================================================
// EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

// Legacy exports - will be removed in future versions
export const SUPPORTED_CHAINS = CHAINS;
export const config = {
  chain: DEFAULT_CHAIN,
  ethScanerUrl: DEFAULT_CHAIN.explorerUrl,
  contracts: CONTRACTS,
  near: NEAR,
};

// Modern exports
export { CHAINS as chains };
export { CONTRACTS as contracts };
export { LOTTERY as lottery };
export { DESIGN as design };
export { API as api };
export { PERFORMANCE as performance };
export { FEATURES as features };

// Type exports
export type ChainConfig = typeof CHAINS[keyof typeof CHAINS];
export type ChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];
export type ContractAddress = typeof CONTRACTS[keyof typeof CONTRACTS];