"use client";

// ============================================================================
// UNIFIED CROSS-CHAIN TYPES - Single Source of Truth
// ============================================================================

/**
 * Standardized chain configuration based on NEAR Chain Signatures
 */
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
  derivationPath: string; // NEAR Chain Signatures derivation path
  type: 'evm' | 'bitcoin';
}

/**
 * NEAR Chain Signature request - Official v1.signer format
 */
export interface ChainSignatureRequest {
  payload: Uint8Array;
  path: string;
  keyVersion?: number;
}

export interface DerivationPath {
  path: string;
  chainId: string;
  accountIndex: number;
}

export interface SignatureResult {
  signature: string;
  recovery?: number;
  publicKey: string;
  derivationPath: DerivationPath;
  timestamp: number;
}

/**
 * NEAR Chain Signature response from v1.signer contract
 */
export interface ChainSignatureResponse {
  signature: {
    r: string;
    s: string;
    v: number;
  };
  publicKey: string;
  recoveryId: number;
}

/**
 * Cross-chain intent parameters for ticket purchases
 */
export interface CrossChainIntentParams {
  sourceChain: keyof typeof SUPPORTED_CHAINS;
  targetChain: keyof typeof SUPPORTED_CHAINS;
  userAddress: string;
  ticketCount: number;
  syndicateId?: string;
  causeAllocation?: number; // Percentage for cause (default: 20%)
}

/**
 * Cross-chain intent state tracking
 */
export interface CrossChainIntent {
  id: string;
  sourceChain: ChainConfig;
  targetChain: ChainConfig;
  userAddress: string;
  ticketCount: number;
  totalAmount: bigint;
  syndicateId?: string;
  causeAllocation?: number;
  status: IntentStatus;
  createdAt: Date;
  updatedAt?: Date;
  txHash?: string;
  sourceHash?: string;
  targetHash?: string;
  errorMessage?: string;
  gasRelayerTxId?: string; // For Multichain Gas Relayer tracking
}

/**
 * Intent execution status
 */
export type IntentStatus = 
  | 'pending'     // Intent created, awaiting signature
  | 'signing'     // NEAR Chain Signature in progress
  | 'signed'      // Signature obtained, awaiting broadcast
  | 'broadcasting'// Transaction being broadcast to target chain
  | 'executed'    // Successfully executed on target chain
  | 'failed'      // Failed at any stage
  | 'expired';    // Intent expired (24h timeout)

/**
 * Cross-chain execution result
 */
export interface CrossChainResult {
  intentId: string;
  txHash?: string;
  status: IntentStatus;
  message: string;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
}

/**
 * Fee estimation breakdown
 */
export interface FeeBreakdown {
  nearGasFee: bigint;        // NEAR gas for chain signature
  targetChainGasFee: bigint; // Target chain gas fee
  bridgeFee: bigint;         // Cross-chain bridge fee (if applicable)
  relayerFee: bigint;        // Multichain Gas Relayer fee
  totalFee: bigint;          // Sum of all fees
  currency: string;          // Fee currency (NEAR, ETH, etc.)
}

/**
 * Gas relayer transaction parameters
 */
export interface GasRelayerParams {
  targetChain: string;
  signedTransaction: string;
  userAddress: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

/**
 * Supported chains configuration
 */
export const SUPPORTED_CHAINS = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    blockExplorer: 'https://etherscan.io',
    derivationPath: 'ethereum,1',
    type: 'evm' as const,
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon.llamarpc.com',
    nativeCurrency: {
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18,
    },
    blockExplorer: 'https://polygonscan.com',
    derivationPath: 'ethereum,137',
    type: 'evm' as const,
  },
  bitcoin: {
    chainId: 0,
    name: 'Bitcoin',
    rpcUrl: 'https://blockstream.info/api',
    nativeCurrency: {
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8,
    },
    blockExplorer: 'https://blockstream.info',
    derivationPath: 'bitcoin,0',
    type: 'bitcoin' as const,
  },
} as const;

/**
 * Contract addresses across supported chains
 */
export const CONTRACT_ADDRESSES = {
  megapot: {
    base: "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95",
    baseSepolia: "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95",
    ethereum: "0x0000000000000000000000000000000000000000", // TBD
    avalanche: "0x0000000000000000000000000000000000000000", // TBD
  },
  usdc: {
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    ethereum: "0xA0b86a33E6441c8C673f4c8b0C8C8e6C5b8b8b8b", // TBD
    avalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC on Avalanche
  },
  syndicate: {
    base: {
      ticketRegistry: "0x86e2d8A3eAcfa89295a75116e9489f07CFBd198B",
      resolver: "0x07B73B99fbB0F82f981A5954A7f3Fd72Ce391c2F",
    },
    lensChain: {
      registry: "0x399f080bB2868371D7a0024a28c92fc63C05536E",
      factory: "0x4996089d644d023F02Bf891E98a00b143201f133",
    },
  },
} as const;

/**
 * NEAR Protocol configuration
 */
export const NEAR_CONFIG = {
  networkId: "mainnet",
  nodeUrl: "https://rpc.mainnet.near.org",
  walletUrl: "https://wallet.mainnet.near.org",
  helperUrl: "https://helper.mainnet.near.org",
  explorerUrl: "https://nearblocks.io",
  
  // Official NEAR Chain Signatures contract
  chainSignatureContract: "v1.signer",
  
  // Gas limits for different operations
  gasLimits: {
    chainSignature: "300000000000000", // 300 TGas
    intentCreation: "100000000000000", // 100 TGas
    statusCheck: "30000000000000",     // 30 TGas
  },
} as const;

/**
 * Multichain Gas Relayer configuration
 */
export const GAS_RELAYER_CONFIG = {
  baseUrl: "https://api.near.org/v1/gas-relayer",
  supportedChains: ["ethereum", "base", "avalanche"] as const,
  maxRetries: 3,
  retryDelay: 2000, // 2 seconds
} as const;