/**
 * TON BRIDGE PROTOCOL
 *
 * ENHANCEMENT FIRST: Extends existing bridge architecture
 * - DRY: Single source of truth via TON → CCTP → Base
 * - CLEAN: Clear separation — TON handles payment, CCTP handles bridging
 * - MODULAR: Implements BridgeProtocol interface for unified management
 *
 * Architecture:
 * 1. User pays USDT/TON via TON Pay SDK → TON smart contract
 * 2. Contract emits attestation event
 * 3. Circle CCTP attestation relayed to Base
 * 4. USDC minted on Base → Megapot ticket purchased
 *
 * TON Compliance:
 * - Telegram blockchain guidelines require TON for on-chain assets
 * - Users interact only with TON; CCTP bridge is backend infrastructure
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
// TON CONTRACT CONSTANTS
// ============================================================================

export const TON_CONTRACTS = {
    LOTTERY: process.env.TON_LOTTERY_CONTRACT || 'EQBLOTTERY_LOTTERY_CONTRACT_DEPLOY_TO_MAINNET',
    USDT: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', // USDT Jetton on TON mainnet
};

// TON address validation regex (EQ/TQ/UQ prefix, 48 chars base64)
const TON_ADDRESS_REGEX = /^[UEQ][A-Za-z0-9_-]{46}$/;

// ============================================================================
// TON PROTOCOL CLASS
// ============================================================================

export class TonProtocol implements BridgeProtocol {
    readonly name = 'ton' as const;
    readonly supportedTokens = [TON_CONTRACTS.USDT, 'TON'];

    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        return sourceChain === 'ton' && destinationChain === 'base';
    }

    async estimate(params: BridgeParams) {
        const amount = Number(params.amount) || 0;
        const fee = Math.min(Math.max(amount * 0.003, 0.01), 1.00).toFixed(2);

        return {
            fee,
            timeMs: 60_000, // TON has sub-second finality; CCTP attestation is the bottleneck
            gasEstimate: '< $0.01',
        };
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        try {
            const validation = await this.validate(params);
            if (!validation.valid) {
                throw new BridgeError(
                    BridgeErrorCode.INVALID_ADDRESS,
                    validation.error || 'Invalid parameters',
                    'ton'
                );
            }

            params.onStatus?.('validating', { protocol: 'ton' });

            return {
                success: false,
                protocol: 'ton',
                status: 'pending_signature' as BridgeStatus,
                bridgeId: `ton-cctp-${Date.now()}`,
                estimatedTimeMs: 60_000,
                details: {
                    message: 'Confirm USDT/TON payment via TON Connect.',
                    sourceChain: params.sourceChain,
                    destinationChain: params.destinationChain,
                    amount: params.amount,
                    recipient: params.destinationAddress,
                    walletAction: {
                        type: 'ton_payment',
                        toAddress: TON_CONTRACTS.LOTTERY,
                        token: params.token || 'USDT',
                        amount: params.amount,
                    },
                    steps: [
                        '1. Confirm TON Pay transaction (USDT/TON)',
                        '2. TON contract receives payment + emits event',
                        '3. Circle generates CCTP attestation',
                        '4. USDC minted on Base → Megapot ticket',
                    ],
                },
            };
        } catch (error) {
            this.failureCount++;
            this.lastFailure = new Date();

            console.error('[TonProtocol] Bridge failed:', error);

            return {
                success: false,
                protocol: 'ton',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: error instanceof BridgeError ? error.code : BridgeErrorCode.UNKNOWN,
            };
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        const total = this.successCount + this.failureCount;
        const successRate = total > 0 ? this.successCount / total : 0.95;
        const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 60_000;

        return {
            protocol: 'ton',
            isHealthy: true,
            successRate,
            averageTimeMs,
            consecutiveFailures: this.failureCount,
            estimatedFee: '< $0.01',
            statusDetails: {
                recentFailures: this.failureCount > 3,
            },
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        if (params.sourceChain !== 'ton' || params.destinationChain !== 'base') {
            return { valid: false, error: 'Unsupported route for TON protocol' };
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
// SINGLETON EXPORT
// ============================================================================

export const tonProtocol = new TonProtocol();
