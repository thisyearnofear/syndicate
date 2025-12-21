/**
 * UNIFIED BRIDGE TYPES
 * 
 * Single source of truth for all bridge-related types across protocols.
 * Follows DRY principle - shared types prevent duplication.
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for all types
 * - CLEAN: Clear type organization by domain
 * - AGGRESSIVE CONSOLIDATION: No duplicate types
 */

// ============================================================================
// Core Bridge Types
// ============================================================================

/**
 * Supported blockchain networks
 */
export type ChainIdentifier =
    | 'ethereum'
    | 'base'
    | 'polygon'
    | 'avalanche'
    | 'solana'
    | 'stacks'   // Stacks Bitcoin L2
    | 'zcash'    // NEW - Zcash support
    | 'near';    // NEAR as orchestration layer

/**
 * Bridge protocols - each protocol is a separate module
 */
export type BridgeProtocolType =
    | 'cctp'      // Circle CCTP (EVM + Solana)
    | 'ccip'      // Chainlink CCIP (EVM only)
    | 'wormhole'  // Wormhole (multi-chain)
    | 'base-solana-bridge' // Base-Solana Bridge (official, Chainlink CCIP)
    | 'debridge'  // deBridge DLN (intent-based fallback)
    | 'near'      // NEAR Chain Signatures
    | 'near-intents' // NEAR Intents (Solver-based)
    | 'stacks'    // Stacks → Base bridge (sBTC → USDC)
    | 'zcash'     // Zcash-specific (uses NEAR as orchestrator)
    | 'auto';     // Automatic selection

/**
 * Bridge transaction status
 */
export type BridgeStatus =
    | 'idle'
    | 'validating'
    | 'approve'           // Approval in progress
    | 'approved'          // Approval complete
    | 'approving'
    | 'burning'
    | 'burn_confirmed'    // Burn transaction confirmed
    | 'waiting_attestation'
    | 'pending_signature' // Waiting for user wallet signature (deBridge)
    | 'solver_waiting_deposit' // deBridge solver waiting for deposit
    | 'minting'
    | 'complete'
    | 'failed';

/**
 * Address types for different chains
 */
export type AddressType = {
    evm?: string;      // 0x... format
    solana?: string;  // Base58 format
    near?: string;    // NEAR account format
    zcash?: string;   // Zcash address format
};

/**
 * Bridge protocol interface - must be implemented by all protocols
 */
export interface BridgeProtocol {
    readonly name: BridgeProtocolType;

    /**
     * Check if this protocol supports the given route
     */
    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean;

    /**
     * Estimate bridge cost and time
     */
    estimate(params: BridgeParams): Promise<BridgeEstimate>;

    /**
     * Execute the bridge
     */
    bridge(params: BridgeParams): Promise<BridgeResult>;

    /**
     * Get current protocol health
     */
    getHealth(): Promise<ProtocolHealth>;

    /**
     * Validate bridge parameters
     */
    validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }>;
}

/**
 * Bridge parameters
 */
export interface BridgeParams {
    sourceChain: ChainIdentifier;
    destinationChain: ChainIdentifier;
    sourceAddress: string;
    destinationAddress: string;
    amount: string; // Amount to bridge (in base units or token decimals)
    token?: string;  // Token address/symbol

    // Optional parameters
    wallet?: any;    // Wallet/signer instance
    protocol?: BridgeProtocolType | 'auto'; // Specific protocol or auto-select
    allowFallback?: boolean; // Allow fallback to other protocols if primary fails
    dryRun?: boolean; // Test without executing

    // Status callbacks
    onStatus?: (status: BridgeStatus, data?: Record<string, unknown>) => void;

    // Additional protocol-specific options
    options?: Record<string, unknown>;
}

/**
 * Bridge estimate
 */
export interface BridgeEstimate {
    fee: string; // Estimated fee in USD
    timeMs: number; // Estimated time in milliseconds
    gasEstimate?: string; // Estimated gas cost
}

/**
 * Bridge result
 */
export interface BridgeResult {
    success: boolean;
    protocol: BridgeProtocolType;

    // Transaction identifiers
    sourceTxHash?: string;
    destinationTxHash?: string;
    messageId?: string;           // For attestation-based bridges
    bridgeId?: string;            // Protocol-specific ID

    // Status
    status: BridgeStatus;
    error?: string;
    errorCode?: string;

    // Fallback suggestions (for failed bridges)
    suggestFallback?: boolean;    // Whether protocol suggests trying fallback
    fallbackReason?: string;      // Human-readable reason for suggesting fallback

    // Timing & Cost
    estimatedTimeMs?: number;
    actualTimeMs?: number;
    gasCost?: string;
    bridgeFee?: string;

    // Details
    details?: Record<string, unknown>;

    // Raw error for debugging
    rawError?: string;
}

/**
 * Bridge route suggestion
 */
export interface BridgeRoute {
    protocol: BridgeProtocolType;
    estimatedTimeMs: number;
    estimatedFee: string;
    successRate: number;
    isRecommended: boolean;
    reason?: string;              // Why recommended/not recommended
    score?: number;              // Overall score (0-100)
}

export const USDC_ADDRESSES: Record<ChainIdentifier, string | undefined> = {
    ethereum: '0xA0b86991c631e50B4f4b4e8A3c02c5d0C2f10d5D',
    base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyB7bF',
    stacks: undefined, // sBTC, not USDC
    zcash: undefined,
    near: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near',
};

// ============================================================================
// Protocol Health & Monitoring
// ============================================================================

export interface ProtocolHealth {
    protocol: BridgeProtocolType;
    isHealthy: boolean;
    successRate: number;          // 0-1 (e.g. 0.95 = 95%)
    averageTimeMs: number;
    lastFailure?: Date;
    lastSuccessTime?: Date;
    consecutiveFailures: number;
    estimatedFee?: string;

    // Additional status details for better monitoring
    statusDetails?: {
        recentFailures?: boolean;
        lowSuccessRate?: boolean;
        lastSuccessTime?: Date | null;
        currentLoad?: 'low' | 'medium' | 'high';
    };
}

// ============================================================================
// Bridge Performance Metrics
// ============================================================================

export interface BridgePerformanceMetrics {
    systemStatus: 'optimal' | 'good' | 'degraded' | 'critical';
    overallSuccessRate: number;
    totalFailures: number;
    averageBridgeTimeMs: number;
    protocols: Array<{
        protocol: BridgeProtocolType;
        isHealthy: boolean;
        successRate: number;
        averageTimeMs: number;
        consecutiveFailures: number;
    }>;
    bestPerformingProtocol: BridgeProtocolType;
    recommendations: string[];
}

// ============================================================================
// Error Handling
// ============================================================================

export enum BridgeErrorCode {
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
    INVALID_ADDRESS = 'INVALID_ADDRESS',
    UNSUPPORTED_ROUTE = 'UNSUPPORTED_ROUTE',
    PROTOCOL_UNAVAILABLE = 'PROTOCOL_UNAVAILABLE',
    ATTESTATION_TIMEOUT = 'ATTESTATION_TIMEOUT',
    ATTESTATION_FAILED = 'ATTESTATION_FAILED',
    TRANSACTION_FAILED = 'TRANSACTION_FAILED',
    TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT',
    WALLET_REJECTED = 'WALLET_REJECTED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
    DEADLINE_PASSED = 'DEADLINE_PASSED',
    ESTIMATION_FAILED = 'ESTIMATION_FAILED',
    INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
    NONCE_ERROR = 'NONCE_ERROR',
    UNKNOWN = 'UNKNOWN',
}

/**
 * Structured bridge error
 */
export class BridgeError extends Error {
    constructor(
        public code: BridgeErrorCode,
        message: string,
        public protocol?: BridgeProtocolType,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'BridgeError';
    }
}

// ============================================================================
// Strategy Pattern Types
// ============================================================================

export interface BridgeStrategy {
    getName(): string;
    getPriority(): number;
    isApplicable(params: BridgeParams): boolean;
    execute(params: BridgeParams): Promise<BridgeResult>;
    adjustForSystemHealth?(metrics: BridgePerformanceMetrics): void;
}

// ============================================================================
// Export for backward compatibility
// ============================================================================

export type {
    ChainIdentifier as ChainId,
    BridgeProtocolType as ProtocolType,
    BridgeStatus as Status,
    BridgeParams as Params,
    BridgeResult as Result,
    BridgeRoute as Route,
    ProtocolHealth as Health,
    BridgePerformanceMetrics as Metrics,
    BridgeErrorCode as ErrorCode,
    BridgeError as Error
};