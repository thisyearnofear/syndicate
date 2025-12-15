/**
 * STACKS PROTOCOL - Bridge Integration
 * 
 * ENHANCEMENT FIRST: Extends existing bridge architecture
 * - DRY: Reuses bridge operator logic from scripts/stacks-bridge-operator.ts
 * - CLEAN: Clear separation between on-chain (Clarity contract) and off-chain (operator)
 * - MODULAR: Implements BridgeProtocol interface for unified management
 * 
 * Architecture:
 * 1. User calls Stacks contract → emits event
 * 2. Bridge operator listens → converts sBTC → USDC
 * 3. Operator executes Megapot purchase on Base
 * 4. Status tracked via existing TrackerStatus system
 */

import type {
    BridgeProtocol,
    BridgeParams,
    BridgeResult,
    ProtocolHealth,
    ChainIdentifier,
} from '../types';
import { BridgeError, BridgeErrorCode } from '../types';

// ============================================================================
// STACKS BRIDGE PROTOCOL
// ============================================================================

export class StacksProtocol implements BridgeProtocol {
    readonly name = 'stacks' as const;

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
        // Stacks bridge fees:
        // - Bridge fee: 0.01 sBTC (configured in contract)
        // - Conversion slippage: ~1-2%
        // - Base gas: ~0.0001 ETH (covered by operator)
        return {
            fee: '0.01', // sBTC
            timeMs: 5 * 60 * 1000, // 5 minutes average
            gasEstimate: 'Covered by operator',
        };
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        const startTime = Date.now();

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

            // ENHANCEMENT: The actual bridge logic is handled by:
            // 1. Stacks contract (contracts/stacks-lottery.clar)
            // 2. Bridge operator (scripts/stacks-bridge-operator.ts)
            // 
            // This protocol acts as the coordinator/interface

            // For Stacks, the bridge is initiated via contract call
            // The UI already handles this via useCrossChainPurchase hook
            // This protocol just validates and tracks

            params.onStatus?.('initiating', { 
                protocol: 'stacks',
                message: 'Waiting for Stacks contract call...'
            });

            // The actual flow is:
            // 1. User calls bridge-and-purchase via @stacks/connect (already implemented in UI)
            // 2. Contract emits event
            // 3. Bridge operator picks up event (scripts/stacks-bridge-operator.ts)
            // 4. Operator processes bridge + purchase
            // 5. Status tracked via /api/purchase-status/[txId]

            // Return pending status - operator will complete the bridge
            const result: BridgeResult = {
                success: true,
                protocol: 'stacks',
                status: 'pending',
                bridgeId: `stacks-pending-${Date.now()}`,
                details: {
                    message: 'Bridge initiated on Stacks. Operator will process the transaction.',
                    sourceChain: params.sourceChain,
                    destinationChain: params.destinationChain,
                    amount: params.amount,
                    recipient: params.destinationAddress,
                },
            };

            // Update health metrics
            this.successCount++;
            this.totalTimeMs += Date.now() - startTime;

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
                errorCode: error instanceof BridgeError ? error.code : BridgeErrorCode.UNKNOWN_ERROR,
            };
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        const total = this.successCount + this.failureCount;
        const successRate = total > 0 ? this.successCount / total : 0.95; // Assume 95% if no data
        const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 300_000; // 5 min default

        // Health check
        const recentFailures = this.failureCount > 3;
        const lowSuccessRate = successRate < 0.7;
        const isHealthy = !recentFailures && !lowSuccessRate && this.failureCount < 5;

        return {
            protocol: 'stacks',
            isHealthy,
            successRate,
            averageTimeMs,
            lastFailure: this.lastFailure,
            consecutiveFailures: this.failureCount,
            estimatedFee: '0.01',
            statusDetails: {
                recentFailures,
                lowSuccessRate,
                lastSuccessTime: this.successCount > 0 ? new Date() : null,
                operatorStatus: 'Check scripts/stacks-bridge-operator.ts logs',
            }
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        // Validate route
        if (!this.supports(params.sourceChain, params.destinationChain)) {
            return { 
                valid: false, 
                error: `Stacks protocol only supports Stacks → Base` 
            };
        }

        // Validate destination address (Base EVM address)
        if (!params.destinationAddress || !params.destinationAddress.startsWith('0x')) {
            return { 
                valid: false, 
                error: 'Destination address must be valid Base address (0x...)' 
            };
        }

        if (params.destinationAddress.length !== 42) {
            return { 
                valid: false, 
                error: 'Invalid EVM address length (must be 42 characters)' 
            };
        }

        // Validate amount
        const amount = parseFloat(params.amount);
        if (isNaN(amount) || amount <= 0) {
            return { 
                valid: false, 
                error: 'Invalid amount (must be positive number)' 
            };
        }

        // Validate minimum (1 ticket = 1 sBTC)
        if (amount < 1) {
            return {
                valid: false,
                error: 'Minimum bridge amount is 1 sBTC (1 lottery ticket)'
            };
        }

        return { valid: true };
    }
}

// ============================================================================
// SINGLETON EXPORT (following existing pattern)
// ============================================================================

export const stacksProtocol = new StacksProtocol();
