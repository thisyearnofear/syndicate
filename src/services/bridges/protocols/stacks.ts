/**
 * STACKS PROTOCOL - Bridge Integration
 * 
 * ENHANCEMENT FIRST: Extends existing bridge architecture
 * - DRY: Single source of truth via Chainhook → Attestation → Proxy
 * - CLEAN: Clear separation - Attestation/CCTP handles bridging, Proxy handles purchase
 * - MODULAR: Implements BridgeProtocol interface for unified management
 * - CONSOLIDATION: Migrating from operator-based to fully decentralized
 * 
 * Architecture:
 * 1. User calls Stacks contract → locks/burns USDCx → emits attestation intent
 * 2. Chainhook detects event → POST to /api/chainhook
 * 3. Attestation service (Stacks/Circle xReserve) confirms → CCTP relays to Base
 * 4. Proxy receives USDC → executes Megapot purchase atomically
 * 5. Status tracked via /api/purchase-status/[txId]
 * 
 * Decentralization:
 * - Uses Circle xReserve + CCTP (attestation-based, no operator)
 * - NO OPERATOR KEY REQUIRED
 * - Fully decentralized via attestation services
 */

import type {
    BridgeProtocol,
    BridgeParams,
    BridgeResult,
    ProtocolHealth,
    ChainIdentifier,
    BridgeStatus,
} from '../types';
import { BridgeError, BridgeErrorCode } from '../types';

// ============================================================================
// STACKS BRIDGE PROTOCOL
// ============================================================================

// CONTRACT ADDRESSES
export const CONTRACTS = {
    // Megapot Syndicate Pool on Stacks
    LOTTERY: 'SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3',
    
    // TOKENS
    USDC: 'SP3Y2ZMEG30CQ97K229TY9RJJ64S2Y96FCDXG5SZ.usdc-token', // legacy/allbridge
    USDCx: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',    // Native Circle USDC
    USDCx_BRIDGE: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx-v1', // CCTP Burner
    sBTC: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', // Stacks Bitcoin
};

export class StacksProtocol implements BridgeProtocol {
    readonly name = 'stacks' as const;
    readonly supportedTokens = [CONTRACTS.USDC, CONTRACTS.USDCx, CONTRACTS.sBTC];

    // Health tracking
    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    // ============================================================================
    // BridgeProtocol Interface Implementation
    // ============================================================================

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        // Stacks → Base only
        return sourceChain === 'stacks' && destinationChain === 'base';
    }

    async estimate(params: BridgeParams) {
        const amount = Number(params.amount) || 0;
        const fee = Math.min(Math.max(amount * 0.005, 0.10), 5.00).toFixed(2);
        const isUSDCx = params.tokenAddress === CONTRACTS.USDCx;

        return {
            fee,
            timeMs: isUSDCx ? 120_000 : 180_000,
            gasEstimate: isUSDCx ? 'Included in CCTP relay' : 'Included in attestation relay',
        };
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        const _startTime = Date.now();

        try {
            // Validate parameters
            const validation = await this.validate(params);
            if (!validation.valid) {
                throw new BridgeError(
                    BridgeErrorCode.INVALID_ADDRESS,
                    validation.error || 'Invalid parameters',
                    'stacks'
                );
            }

            params.onStatus?.('validating', { protocol: 'stacks' });

            // Use tokenAddress from params if provided, otherwise default to USDCx
            const tokenAddress = params.tokenAddress || CONTRACTS.USDCx;
            const isNativeUsdc = tokenAddress === CONTRACTS.USDCx;
            const isSbtc = tokenAddress === CONTRACTS.sBTC;

            // Return pending_signature — not yet successful until user signs and tx confirms
            const result: BridgeResult = {
                success: false,
                protocol: 'stacks',
                status: 'pending_signature' as BridgeStatus,
                bridgeId: `stacks-${isNativeUsdc ? 'cctp' : 'attestation'}-${Date.now()}`,
                estimatedTimeMs: isNativeUsdc ? 120_000 : 180_000, // CCTP is usually faster
                details: {
                    message: isNativeUsdc 
                        ? 'Sign transaction to burn USDCx and initiate Circle CCTP bridging.'
                        : isSbtc
                        ? 'Sign transaction to bridge sBTC to Base via Syndicate Pool.'
                        : 'Sign transaction to initiate USDC bridging via attestation.',
                    sourceChain: params.sourceChain,
                    destinationChain: params.destinationChain,
                    amount: params.amount,
                    recipient: params.destinationAddress,
                    walletAction: {
                        type: 'stacks_contract_call',
                        contractAddress: CONTRACTS.LOTTERY.split('.')[0],
                        contractName: CONTRACTS.LOTTERY.split('.')[1],
                        functionName: 'bridge-and-purchase',
                        functionArgs: {
                            ticketCount: params.amount,
                            baseAddress: params.destinationAddress,
                            tokenPrincipal: tokenAddress,
                        },
                        tokenAddress: tokenAddress,
                        network: 'mainnet',
                    },
                    steps: isNativeUsdc ? [
                        '1. Sign Stacks transaction (burns USDCx)',
                        '2. Circle generates attestation',
                        '3. CCTP mints USDC on Base',
                        '4. Proxy executes ticket purchase',
                    ] : [
                        '1. Sign Stacks transaction (locks/burns assets)',
                        '2. Attestation generated by Syndicate service',
                        '3. CCTP/Relayer moves value to Base',
                        '4. Proxy executes ticket purchase',
                    ],
                },
            };

            // pending_signature is not a failure — don't penalise health metrics yet
            // Health is updated externally once the tx is confirmed via chainhook

            return result;

        } catch (error) {
            this.failureCount++;
            this.lastFailure = new Date();

            console.error('[StacksProtocol] Bridge failed:', error);

            return {
                success: false,
                protocol: 'stacks',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: error instanceof BridgeError ? error.code : BridgeErrorCode.UNKNOWN,
            };
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        const total = this.successCount + this.failureCount;
        const successRate = total > 0 ? this.successCount / total : 0.95;
        const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 180_000;

        return {
            protocol: 'stacks',
            isHealthy: true,
            successRate,
            averageTimeMs,
            consecutiveFailures: this.failureCount,
            estimatedFee: '0.50',
            statusDetails: {
                recentFailures: this.failureCount > 3,
            }
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        if (params.sourceChain !== 'stacks' || params.destinationChain !== 'base') {
            return { valid: false, error: 'Unsupported route for Stacks protocol' };
        }
        if (!params.destinationAddress || !params.destinationAddress.startsWith('0x') || params.destinationAddress.length !== 42) {
            return { valid: false, error: 'Invalid destination EVM address' };
        }
        if (!params.amount || Number(params.amount) <= 0) {
            return { valid: false, error: 'Invalid amount' };
        }
        return { valid: true };
    }
}

// ============================================================================
// SINGLETON EXPORT (following existing pattern)
// ============================================================================

export const stacksProtocol = new StacksProtocol();
