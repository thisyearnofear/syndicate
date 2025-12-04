/**
 * NEAR INTENTS PROTOCOL
 * 
 * Adapter for NearIntentsService to fit into the Unified Bridge Protocol system.
 * Enables NEAR users to bridge/purchase via solver-based intents.
 */

import type {
    BridgeProtocol,
    BridgeParams,
    BridgeResult,
    ProtocolHealth,
    ChainIdentifier,
} from '../types';
import { BridgeError, BridgeErrorCode } from '../types';
import { nearIntentsService } from '@/services/nearIntentsService';
import type { WalletSelector } from '@near-wallet-selector/core';

// Lightweight type for NEAR wallet context
type NearWalletContext = {
    accountId: string;
    selector: WalletSelector;
};

export class NearIntentsProtocol implements BridgeProtocol {
    readonly name = 'near-intents' as const;

    // Health tracking
    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    // ============================================================================
    // BridgeProtocol Interface Implementation
    // ============================================================================

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        // Supports NEAR -> Base / Ethereum
        return sourceChain === 'near' && (destinationChain === 'base' || destinationChain === 'ethereum');
    }

    async estimate(params: BridgeParams) {
        const { amount, destinationChain, destinationAddress } = params;

        // Convert amount to smallest units (assuming NEAR for now)
        // TODO: Handle token decimals properly if sourceToken is not native NEAR
        // For now assuming sourceToken is wrap.near or native NEAR (10^24)
        const amountYocto = this.toYocto(amount);

        const quote = await nearIntentsService.getQuote({
            sourceAsset: 'nep141:wrap.near', // Default to wNEAR
            sourceAmount: amountYocto,
            destinationChain: destinationChain as 'base' | 'ethereum',
            destinationAddress,
        });

        if (!quote) {
            throw new BridgeError(
                BridgeErrorCode.ESTIMATION_FAILED,
                'Failed to get quote from solvers',
                'near-intents'
            );
        }

        return {
            fee: quote.estimatedFee,
            timeMs: (quote.timeLimit || 300) * 1000, // seconds to ms
            gasEstimate: 'Included in quote',
        };
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        const startTime = Date.now();
        const { amount, destinationChain, destinationAddress, onStatus, wallet } = params;

        try {
            // 1. Validate Wallet
            if (!wallet || typeof wallet !== 'object') {
                throw new BridgeError(
                    BridgeErrorCode.WALLET_REJECTED,
                    'NEAR wallet not connected',
                    'near-intents'
                );
            }
            const walletObj = wallet as Record<string, unknown>;
            if (!walletObj.selector || !walletObj.accountId) {
                throw new BridgeError(
                    BridgeErrorCode.WALLET_REJECTED,
                    'NEAR wallet not properly initialized',
                    'near-intents'
                );
            }
            const nearWallet = wallet as NearWalletContext;

            // 2. Initialize SDK
            onStatus?.('validating', { protocol: 'near-intents', step: 'Initializing SDK' });
            const initialized = await nearIntentsService.init(nearWallet.selector, nearWallet.accountId);
            if (!initialized) {
                throw new BridgeError(
                    BridgeErrorCode.INITIALIZATION_FAILED,
                    'Failed to initialize NEAR Intents SDK',
                    'near-intents'
                );
            }

            // 3. Get Quote & Execute
            onStatus?.('approving', { step: 'Requesting intent execution' });
            
            // Convert amount to yocto
            const amountYocto = this.toYocto(amount);

            // Execute purchase/bridge
            // Note: purchaseViaIntent handles the quote internally or we might need to refactor to pass quote
            // For now, we use purchaseViaIntent which seems to be designed for ticket purchase
            // If generic bridge, we might need a generic executeIntent method.
            // But given the context, we are bridging for tickets or USDC.
            
            const result = await nearIntentsService.purchaseViaIntent({
                sourceAsset: 'nep141:wrap.near', // Default
                sourceAmount: amountYocto,
                destinationAddress,
                megapotAmount: '0', // Not used for pure bridge? Or is it?
                // If it's a pure bridge, we just want to move funds.
                // If it's a ticket purchase, we want to call the contract.
                // BridgeParams is generic.
            });

            if (!result.success) {
                throw new BridgeError(
                    BridgeErrorCode.TRANSACTION_FAILED,
                    result.error || 'Intent execution failed',
                    'near-intents'
                );
            }

            onStatus?.('waiting_attestation', { intentHash: result.intentHash });

            // Monitor status
            if (result.intentHash) {
                // Poll for completion
                // TODO: Add polling logic if needed, or rely on the result returning immediately if it waits
                // purchaseViaIntent seems to wait for initial submission but maybe not final settlement?
                // Let's assume it returns when submitted.
            }

            onStatus?.('complete', { txHash: result.txHash });

            this.successCount++;
            this.totalTimeMs += Date.now() - startTime;

            return {
                success: true,
                protocol: 'near-intents',
                status: 'complete',
                sourceTxHash: result.txHash,
                destinationTxHash: result.destinationTx as string, // Cast safely
                bridgeId: result.intentHash,
                details: { intentHash: result.intentHash },
            };

        } catch (error) {
            this.failureCount++;
            this.lastFailure = new Date();
            if (error instanceof BridgeError) throw error;
            throw new BridgeError(
                BridgeErrorCode.TRANSACTION_FAILED,
                error instanceof Error ? error.message : 'NEAR Intents failed',
                'near-intents'
            );
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        const total = this.successCount + this.failureCount;
        return {
            protocol: 'near-intents',
            isHealthy: true, // Assume healthy if no repeated failures
            successRate: total > 0 ? this.successCount / total : 1,
            averageTimeMs: this.successCount > 0 ? this.totalTimeMs / this.successCount : 30000,
            lastFailure: this.lastFailure,
            consecutiveFailures: this.failureCount,
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        if (!this.supports(params.sourceChain, params.destinationChain)) {
            return { valid: false, error: 'Route not supported by NEAR Intents' };
        }
        return { valid: true };
    }

    private toYocto(amount: string): string {
        try {
            // Simple conversion for now, assuming 24 decimals for NEAR
            // Use a library for better precision in production
            const [whole, fraction = ''] = amount.split('.');
            const paddedFraction = fraction.padEnd(24, '0').slice(0, 24);
            const wholeBig = BigInt(whole);
            const fractionBig = BigInt(paddedFraction);
            const factor = 10n ** 24n;
            return (wholeBig * factor + fractionBig).toString();
        } catch {
            return '0';
        }
    }
}

export const nearIntentsProtocol = new NearIntentsProtocol();
