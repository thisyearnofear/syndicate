/**
 * DEBRIDGE PROTOCOL
 * 
 * Intent-based cross-chain bridge for Solana -> Base.
 * Replaces the manual Portal Bridge fallback with automated DeBridge DLN.
 * 
 * Flow: 
 * 1. Query DeBridge API for order creation
 * 2. User signs Solana transaction (includes externalCall for atomic Megapot purchase)
 * 3. DeBridge solvers fulfill the order on Base
 * 4. Monitor fulfillment status
 * 
 * Principles:
 * - ENHANCEMENT: Adds automated Solana bridging
 * - CLEAN: Encapsulates DeBridge API interactions
 * - DRY: Reuses shared types
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

const DEBRIDGE_API_BASE = 'https://dln.debridge.finance/v1.0';
const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export class DebridgeProtocol implements BridgeProtocol {
    readonly name = 'debridge' as const;

    // Health tracking
    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    // ============================================================================
    // BridgeProtocol Interface Implementation
    // ============================================================================

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        return sourceChain === 'solana' && destinationChain === 'base';
    }

    async estimate(params: BridgeParams) {
        try {
            const response = await fetch(
                `${DEBRIDGE_API_BASE}/quote?srcChainId=7565164&dstChainId=8453&srcChainTokenIn=${SOLANA_USDC_MINT}&dstChainTokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=${params.amount}000000`,
                { signal: AbortSignal.timeout(5000) }
            );
            
            if (response.ok) {
                const data = await response.json();
                return {
                    fee: data.estimatedFee || '0.50',
                    timeMs: (data.estimatedFulfillmentTimeSec || 120) * 1000,
                    gasEstimate: '~0.0001 SOL',
                };
            }
        } catch {
            // Fallback to defaults
        }

        return {
            fee: '0.50',
            timeMs: 120_000, // ~2 minutes
            gasEstimate: '~0.0001 SOL',
        };
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        const _startTime = Date.now();
        const { amount, destinationAddress, onStatus, options } = params;

        try {
            onStatus?.('validating', { protocol: 'debridge' });

            // Check if we have a resume (already signed, waiting for fulfillment)
            if (options?.bridgeId) {
                onStatus?.('waiting_attestation', { bridgeId: options.bridgeId });
                return await this.pollFulfillment(options.bridgeId as string);
            }

            // Build DeBridge order creation payload
            const orderPayload: Record<string, unknown> = {
                srcChainId: 7565164, // Solana
                dstChainId: 8453, // Base
                srcChainTokenIn: SOLANA_USDC_MINT,
                dstChainTokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
                amount: `${parseFloat(amount) * 1_000_000}`, // USDC has 6 decimals
                dstChainTokenOutRecipient: destinationAddress,
            };

            // Add optional fields if provided
            if (options?.externalCall) {
                orderPayload.externalCall = options.externalCall;
            }
            if (options?.fallbackAddress) {
                orderPayload.fallbackAddress = options.fallbackAddress;
            }

            const response = await fetch(`${DEBRIDGE_API_BASE}/tx`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload),
            });

            if (!response.ok) {
                throw new BridgeError(
                    BridgeErrorCode.NETWORK_ERROR,
                    `DeBridge API error: ${response.statusText}`,
                    'debridge'
                );
            }

            const data = await response.json();

            // Return pending_signature — user needs to sign the Solana transaction
            const result: BridgeResult = {
                success: false,
                protocol: 'debridge',
                status: 'pending_signature' as BridgeStatus,
                bridgeId: data.txHash || `debridge-${Date.now()}`,
                estimatedTimeMs: 120_000,
                details: {
                    message: 'Sign transaction in Solana wallet (Phantom) to initiate DeBridge order.',
                    sourceChain: params.sourceChain,
                    destinationChain: params.destinationChain,
                    amount: params.amount,
                    recipient: destinationAddress,
                    walletAction: {
                        type: 'solana_transaction',
                        serializedTx: data.tx, // Base64 encoded Solana transaction
                        instructions: data.instructions,
                    },
                    steps: [
                        '1. Sign Solana transaction (transfers USDC to DeBridge DLN)',
                        '2. DeBridge solvers detect the order',
                        '3. Solvers execute external call (Megapot purchase) on Base',
                        '4. Order fulfilled automatically',
                    ],
                },
            };

            return result;

        } catch (error) {
            this.failureCount++;
            this.lastFailure = new Date();

            console.error('[DebridgeProtocol] Bridge failed:', error);

            return {
                success: false,
                protocol: 'debridge',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: error instanceof BridgeError ? error.code : BridgeErrorCode.UNKNOWN,
            };
        }
    }

    /**
     * Poll DeBridge API for order fulfillment status
     */
    private async pollFulfillment(bridgeId: string): Promise<BridgeResult> {
        try {
            const response = await fetch(`${DEBRIDGE_API_BASE}/tx/status?txHash=${bridgeId}`, {
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                throw new BridgeError(
                    BridgeErrorCode.NETWORK_ERROR,
                    `DeBridge status API error: ${response.statusText}`,
                    'debridge'
                );
            }

            const data = await response.json();

            if (data.state === 'Fulfilled') {
                this.successCount++;
                return {
                    success: true,
                    protocol: 'debridge',
                    status: 'complete' as BridgeStatus,
                    sourceTxHash: bridgeId,
                    destinationTxHash: data.dstChainTxHash,
                    bridgeId,
                    actualTimeMs: this.totalTimeMs / (this.successCount || 1),
                };
            }

            if (data.state === 'Failed' || data.state === 'Cancelled') {
                this.failureCount++;
                this.lastFailure = new Date();
                return {
                    success: false,
                    protocol: 'debridge',
                    status: 'failed' as BridgeStatus,
                    error: `DeBridge order ${data.state.toLowerCase()}`,
                    errorCode: BridgeErrorCode.TRANSACTION_FAILED,
                    bridgeId,
                };
            }

            // Still pending
            return {
                success: true,
                protocol: 'debridge',
                status: 'bridging' as BridgeStatus,
                sourceTxHash: bridgeId,
                bridgeId,
                details: {
                    state: data.state,
                    message: `Order is ${data.state}. Waiting for solver fulfillment.`,
                },
            };

        } catch (error) {
            console.error('[DebridgeProtocol] Poll fulfillment failed:', error);
            return {
                success: false,
                protocol: 'debridge',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Status check failed',
                errorCode: BridgeErrorCode.NETWORK_ERROR,
                bridgeId,
            };
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        const total = this.successCount + this.failureCount;
        const successRate = total > 0 ? this.successCount / total : 0.95;
        const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 120_000;

        // Check DeBridge API health
        let isHealthy = true;
        try {
            const response = await fetch(`${DEBRIDGE_API_BASE}/quote?srcChainId=7565164&dstChainId=8453&srcChainTokenIn=${SOLANA_USDC_MINT}&dstChainTokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=1000000`, { 
                signal: AbortSignal.timeout(5000) 
            });
            isHealthy = response.ok;
        } catch {
            isHealthy = false;
        }

        return {
            protocol: 'debridge',
            isHealthy,
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
        if (params.sourceChain !== 'solana' || params.destinationChain !== 'base') {
            return { valid: false, error: 'Unsupported route for DeBridge protocol' };
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

export const debridgeProtocol = new DebridgeProtocol();
