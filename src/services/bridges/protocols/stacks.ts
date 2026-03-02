/**
 * STACKS PROTOCOL - Bridge Integration
 * 
 * ENHANCEMENT FIRST: Extends existing bridge architecture
 * - DRY: Single source of truth via Chainhook → Wormhole NTT → Proxy
 * - CLEAN: Clear separation - Wormhole handles bridging, Proxy handles purchase
 * - MODULAR: Implements BridgeProtocol interface for unified management
 * - CONSOLIDATION: Migrating from operator-based to fully decentralized
 * 
 * Architecture:
 * 1. User calls Stacks contract → locks/burns USDC → emits Wormhole message
 * 2. Chainhook detects event → POST to /api/chainhook
 * 3. API processes: Wormhole Guardians attest → Executor relays to Base
 * 4. Proxy receives USDC → executes Megapot purchase atomically
 * 5. Status tracked via /api/purchase-status/[txId]
 * 
 * Decentralization:
 * - Uses Wormhole NTT with Executor (permissionless relaying)
 * - NO OPERATOR KEY REQUIRED
 * - Fallback: StacksBridgeOperator (temporary, to be removed after NTT stable)
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
import { wormholeNttProtocol } from './wormhole-ntt';

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
        // ENHANCEMENT FIRST: Delegate to Wormhole NTT for estimates
        // Falls back to manual estimate if Wormhole unavailable
        try {
            return await wormholeNttProtocol.estimate(params);
        } catch (error) {
            console.warn('[StacksProtocol] Wormhole estimate failed, using fallback:', error);
            return {
                fee: '0.50', // Wormhole relay fee
                timeMs: 180_000, // 3 minutes
                gasEstimate: 'Included in relay fee',
            };
        }
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

            // ENHANCEMENT: Delegate to Wormhole NTT protocol
            // This uses the Executor for permissionless relaying (NO OPERATOR KEY)
            const result = await wormholeNttProtocol.bridge(params);

            // Update health metrics
            if (result.success) {
                this.successCount++;
                this.totalTimeMs += Date.now() - startTime;
            } else {
                this.failureCount++;
                this.lastFailure = new Date();
            }

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
        // ENHANCEMENT FIRST: Delegate to Wormhole NTT for health
        try {
            return await wormholeNttProtocol.getHealth();
        } catch (error) {
            console.warn('[StacksProtocol] Wormhole health check failed:', error);
            // Fallback to local metrics
            const total = this.successCount + this.failureCount;
            const successRate = total > 0 ? this.successCount / total : 0.95;
            const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 180_000;

            return {
                protocol: 'stacks',
                isHealthy: true, // Assume healthy if Wormhole check fails
                successRate,
                averageTimeMs,
                consecutiveFailures: this.failureCount,
                estimatedFee: '0.50',
                statusDetails: {
                    note: 'Wormhole health check unavailable',
                }
            };
        }
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        // ENHANCEMENT FIRST: Delegate to Wormhole NTT for validation
        return await wormholeNttProtocol.validate(params);
    }
}

// ============================================================================
// SINGLETON EXPORT (following existing pattern)
// ============================================================================

export const stacksProtocol = new StacksProtocol();
