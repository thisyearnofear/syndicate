/**
 * STARKNET BRIDGE PROTOCOL
 * 
 * Enables Starknet users to purchase Base Megapot tickets via Orbiter/LayerSwap-style bridging.
 * Flow: User signs Starknet tx -> Bridge relayer -> Base ticket minted.
 * 
 * Principles:
 * - ENHANCEMENT: Adds Starknet capability to unified bridge system
 * - CLEAN: Encapsulates Starknet-specific logic
 * - DRY: Reuses shared types and config
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
import { USDC_ADDRESSES, STRK_ADDRESSES } from '../types';

export class StarknetProtocol implements BridgeProtocol {
    readonly name = 'starknet' as const;

    // Health tracking
    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    // ============================================================================
    // BridgeProtocol Interface Implementation
    // ============================================================================

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        return sourceChain === 'starknet' && destinationChain === 'base';
    }

    async estimate(params: BridgeParams) {
        void params;
        return {
            fee: '0.40', // ~$0.40 in Starknet gas + bridge fees
            timeMs: 240_000, // ~4 minutes for Starknet confirmation + bridge
            gasEstimate: '~0.001 STRK',
        };
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        const _startTime = Date.now();
        const { amount, destinationAddress, onStatus } = params;

        try {
            onStatus?.('validating', { protocol: 'starknet' });

            // Validate destination address is valid EVM format
            if (!destinationAddress || !destinationAddress.startsWith('0x') || destinationAddress.length !== 42) {
                throw new BridgeError(
                    BridgeErrorCode.INVALID_ADDRESS,
                    'Destination address must be a valid EVM address (0x...)',
                    'starknet'
                );
            }

            const tokenAddress = params.tokenAddress || USDC_ADDRESSES.starknet;
            const isStrk = tokenAddress === STRK_ADDRESSES.starknet;

            // Return pending_signature — user needs to sign via Starknet wallet (ArgentX/Braavos)
            // The actual execution happens in useUnifiedPurchase -> handleStarknetWalletSign
            const result: BridgeResult = {
                success: false,
                protocol: 'starknet',
                status: 'pending_signature' as BridgeStatus,
                bridgeId: `starknet-bridge-${Date.now()}`,
                estimatedTimeMs: 240_000,
                details: {
                    message: `Sign transaction in Starknet wallet to bridge ${isStrk ? 'STRK' : 'USDC'} to Base.`,
                    sourceChain: params.sourceChain,
                    destinationChain: params.destinationChain,
                    amount: params.amount,
                    recipient: destinationAddress,
                    walletAction: {
                        type: 'starknet_contract_call',
                        tokenAddress: tokenAddress,
                        amount: amount,
                        baseAddress: destinationAddress,
                        // Calls array will be built by the handler using starknet.js
                    },
                    steps: [
                        '1. Sign Starknet transaction (transfers tokens to bridge contract)',
                        '2. Bridge relayer detects transfer',
                        '3. Relayer mints/sends equivalent USDC on Base',
                        '4. Megapot contract executes ticket purchase',
                    ],
                },
            };

            return result;

        } catch (error) {
            this.failureCount++;
            this.lastFailure = new Date();

            console.error('[StarknetProtocol] Bridge failed:', error);

            return {
                success: false,
                protocol: 'starknet',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: error instanceof BridgeError ? error.code : BridgeErrorCode.UNKNOWN,
            };
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        const total = this.successCount + this.failureCount;
        const successRate = total > 0 ? this.successCount / total : 0.95;
        const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 240_000;

        // Check Starknet RPC health
        let isHealthy = true;
        try {
            const response = await fetch('https://starknet-mainnet.public.blastapi.io', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'starknet_chainId', params: [], id: 1 }),
                signal: AbortSignal.timeout(5000)
            });
            isHealthy = response.ok;
        } catch {
            isHealthy = false;
        }

        return {
            protocol: 'starknet',
            isHealthy,
            successRate,
            averageTimeMs,
            consecutiveFailures: this.failureCount,
            estimatedFee: '0.40',
            statusDetails: {
                recentFailures: this.failureCount > 3,
            }
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        if (params.sourceChain !== 'starknet' || params.destinationChain !== 'base') {
            return { valid: false, error: 'Unsupported route for Starknet protocol' };
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

export const starknetProtocol = new StarknetProtocol();
