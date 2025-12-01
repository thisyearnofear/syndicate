/**
 * UNIFIED BRIDGE TYPES
 * 
 * Single source of truth for all bridge-related types across protocols.
 * Follows DRY principle - shared types prevent duplication.
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
    | 'zcash'    // NEW - Zcash support
    | 'near';    // NEAR as orchestration layer

/**
 * Bridge protocols - each protocol is a separate module
 */
export type BridgeProtocolType =
    | 'cctp'      // Circle CCTP (EVM + Solana)
    | 'ccip'      // Chainlink CCIP (EVM only)
    | 'wormhole'  // Wormhole (multi-chain)
    | 'near'      // NEAR Chain Signatures + Intents
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
    | 'minting'
    | 'complete'
    | 'failed';

/**
 * Address types across different chains
 */
export type AddressType = {
    evm: string;        // 0x... format (42 chars)
    solana: string;     // base58 format
    zcash: string;      // z-address (shielded) or t-address (transparent)
    near: string;       // account.near format
};

// ============================================================================
// Bridge Request/Response
// ============================================================================

/**
 * Unified bridge parameters - works for ALL protocols
 */
export interface BridgeParams {
    // Source
    sourceChain: ChainIdentifier;
    sourceAddress: string;
    sourceToken: string;          // Token address or identifier

    // Destination
    destinationChain: ChainIdentifier;
    destinationAddress: string;
    destinationToken?: string;    // Optional: different token on dest

    // Amount
    amount: string;               // Decimal string (e.g. "100.5")

    // Options
    protocol?: BridgeProtocolType;
    slippage?: number;            // Max slippage tolerance (basis points)
    deadline?: number;            // Unix timestamp

    // Wallet/Signer
    wallet?: any;                 // Wallet instance (type varies by chain)

    // Callbacks
    onStatus?: (status: BridgeStatus, data?: any) => void;
    onProgress?: (percent: number) => void;

    // Flags
    dryRun?: boolean;             // Simulate without executing
    allowFallback?: boolean;      // Allow fallback to other protocols
    details?: Record<string, any>; // Protocol-specific extra data
}

/**
 * Unified bridge result - consistent across all protocols
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

    // Timing & Cost
    estimatedTimeMs?: number;
    actualTimeMs?: number;
    gasCost?: string;
    bridgeFee?: string;

    // Details
    details?: Record<string, any>;
}

// ============================================================================
// Protocol Health & Monitoring
// ============================================================================

/**
 * Protocol health status
 */
export interface ProtocolHealth {
    protocol: BridgeProtocolType;
    isHealthy: boolean;
    successRate: number;          // 0-1 (e.g. 0.95 = 95%)
    averageTimeMs: number;
    lastFailure?: Date;
    consecutiveFailures: number;
    estimatedFee?: string;
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
}

// ============================================================================
// Protocol Interface
// ============================================================================

/**
 * All bridge protocols must implement this interface
 * Ensures consistency and composability
 */
export interface BridgeProtocol {
    /**
     * Protocol identifier
     */
    readonly name: BridgeProtocolType;

    /**
     * Check if protocol supports this route
     */
    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean;

    /**
     * Estimate bridge cost and time
     */
    estimate(params: BridgeParams): Promise<{
        fee: string;
        timeMs: number;
        gasEstimate?: string;
    }>;

    /**
     * Execute bridge transaction
     */
    bridge(params: BridgeParams): Promise<BridgeResult>;

    /**
     * Get current health status
     */
    getHealth(): Promise<ProtocolHealth>;

    /**
     * Validate parameters before execution
     */
    validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }>;
}

// ============================================================================
// Zcash-Specific Types
// ============================================================================

/**
 * Zcash address types
 */
export type ZcashAddressType =
    | 'shielded'      // z-address (private)
    | 'transparent';  // t-address (public)

/**
 * Zcash transaction parameters
 */
export interface ZcashTxParams {
    from: string;                 // z-address or t-address
    to: string;
    amount: string;
    memo?: string;                // Encrypted memo (shielded only)
    addressType: ZcashAddressType;
}

/**
 * Zcash shielded balance (only visible with viewing key)
 */
export interface ZcashShieldedBalance {
    address: string;              // z-address
    balance: string;
    verified: boolean;            // Verified with viewing key
    viewingKey?: string;          // Optional: for client-side verification
}

/**
 * NEAR Intent for Zcash → Base bridge
 */
export interface ZcashBridgeIntent {
    sourceAddress: string;        // Zcash z-address
    destinationAddress: string;   // Base EVM address
    amount: string;
    intermediateSteps: {
        zcashToNear?: {
            nearAccount: string;
            wrappedToken: string;
        };
        nearToBase?: {
            bridgeContract: string;
            destinationToken: string;
        };
    };
}

// ============================================================================
// Attestation Types (for CCTP, etc.)
// ============================================================================

/**
 * Attestation status
 */
export interface AttestationStatus {
    available: boolean;
    attestation?: string;         // Hex-encoded attestation
    retries: number;
    nextRetryMs?: number;
}

/**
 * Attestation fetch options
 */
export interface AttestationOptions {
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    exponentialBackoff?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Bridge error codes
 */
export enum BridgeErrorCode {
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    INVALID_ADDRESS = 'INVALID_ADDRESS',
    UNSUPPORTED_ROUTE = 'UNSUPPORTED_ROUTE',
    PROTOCOL_UNAVAILABLE = 'PROTOCOL_UNAVAILABLE',
    ATTESTATION_TIMEOUT = 'ATTESTATION_TIMEOUT',
    TRANSACTION_FAILED = 'TRANSACTION_FAILED',
    WALLET_REJECTED = 'WALLET_REJECTED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
    DEADLINE_PASSED = 'DEADLINE_PASSED',
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
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = 'BridgeError';
    }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if address is EVM format
 */
export function isEvmAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if address is Solana format
 */
export function isSolanaAddress(address: string): boolean {
    // Base58 format, 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Check if address is Zcash shielded (z-address)
 */
export function isZcashShieldedAddress(address: string): boolean {
    return address.startsWith('z') && address.length === 78;
}

/**
 * Check if address is Zcash transparent (t-address)
 */
export function isZcashTransparentAddress(address: string): boolean {
    return address.startsWith('t') && address.length === 35;
}

/**
 * Check if address is NEAR account
 */
export function isNearAddress(address: string): boolean {
    return /^[a-z0-9_-]+\.near$/.test(address) || /^[a-f0-9]{64}$/.test(address);
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Map chain to native token symbol
 */
export const NATIVE_TOKENS: Record<ChainIdentifier, string> = {
    ethereum: 'ETH',
    base: 'ETH',
    polygon: 'MATIC',
    avalanche: 'AVAX',
    solana: 'SOL',
    zcash: 'ZEC',
    near: 'NEAR',
};

/**
 * Map chain to USDC token address/mint
 */
export const USDC_ADDRESSES: Partial<Record<ChainIdentifier, string>> = {
    ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    // Zcash: No native USDC (bridges via NEAR)
};
