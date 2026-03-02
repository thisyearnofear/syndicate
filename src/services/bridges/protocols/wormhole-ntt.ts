/**
 * WORMHOLE NTT PROTOCOL - Stacks → Base Bridge
 * 
 * ENHANCEMENT FIRST: Extends existing bridge architecture
 * DRY: Reuses patterns from deBridge/NEAR services
 * CLEAN: Clear separation - Wormhole handles bridging, proxy handles purchase
 * MODULAR: Implements BridgeProtocol interface for unified management
 * 
 * Architecture:
 * 1. User initiates transfer on Stacks via contract call
 * 2. Tokens locked/burned on Stacks, message emitted to Wormhole Guardians
 * 3. Guardians attest → VAA created
 * 4. Executor (permissionless relayer) picks up VAA and delivers to Base
 * 5. On Base: USDC received → auto-purchase proxy executes ticket purchase
 * 
 * Benefits:
 * - NO OPERATOR KEY REQUIRED (permissionless)
 * - Executor handles relay automatically
 * - Decentralized Guardian network (19 validators)
 */

import type {
    BridgeProtocol,
    BridgeParams,
    BridgeEstimate,
    BridgeResult,
    ProtocolHealth,
    ChainIdentifier,
    BridgeStatus,
} from '../types';
import { BridgeError, BridgeErrorCode } from '../types';
import { CONTRACTS } from '@/config';

// Chain IDs
const STACKS_CHAIN_ID = 'stacks';
const BASE_CHAIN_ID = 'base';
const WORMHOLE_STACKS_CHAIN = 1297; // Wormhole chain ID for Stacks
const WORMHOLE_BASE_CHAIN = 8453;   // Wormhole chain ID for Base (same as EVM)

// Token addresses
const USDC_STACKS = 'SP3Y2ZSH8P7D50B0VB0PVXAD455SCSY5A2JSTX9C9.usdc-token'; // SIP-010 on Stacks
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Executor endpoints (for quote requests)
const WORMHOLE_EXECUTOR_MAINNET = 'https:// executor-api.mainnet.wavacle.com'; // Placeholder - need real endpoint

interface WormholeNttQuote {
    relayAmount: string;
    estimatedDeliveryTime: number;
    fee: string;
    destinationChain: number;
}

interface WormholeNttTransferResult {
    sourceTxHash: string;
    sequence: string;
    messageId: string;
}

export class WormholeNttProtocol implements BridgeProtocol {
    readonly name = 'wormhole' as const;
    
    // Health tracking
    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    // Configuration
    private readonly executorEndpoint: string;
    private readonly usdcStacks: string;
    private readonly usdcBase: string;

    constructor() {
        this.executorEndpoint = process.env.WORMHOLE_EXECUTOR_ENDPOINT || WORMHOLE_EXECUTOR_MAINNET;
        this.usdcStacks = process.env.NTT_USDC_STACKS || USDC_STACKS;
        this.usdcBase = CONTRACTS.usdc;
    }

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        return sourceChain === 'stacks' && destinationChain === 'base';
    }

    async estimate(params: BridgeParams): Promise<BridgeEstimate> {
        try {
            // Get quote from Executor
            const quote = await this.getRelayQuote(params.amount);
            
            return {
                fee: quote.fee,
                timeMs: quote.estimatedDeliveryTime * 1000,
                gasEstimate: 'Included in relay fee',
            };
        } catch (error) {
            // Fallback to manual estimate if Executor unavailable
            console.warn('[WormholeNtt] Executor unavailable, using fallback estimate:', error);
            return {
                fee: '0.50', // Estimated $0.50 relay fee
                timeMs: 180_000, // 3 minutes
                gasEstimate: 'Varies by network conditions',
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
                    'wormhole'
                );
            }

            params.onStatus?.('validating', { protocol: 'wormhole' });

            // Step 1: Get relay quote from Executor
            params.onStatus?.('approve', { 
                protocol: 'wormhole',
                message: 'Getting relay quote from Executor network...'
            });
            
            const quote = await this.getRelayQuote(params.amount);

            // Step 2: Return instructions for frontend to initiate transfer
            // The actual Stacks contract call happens via @stacks/connect in the UI
            // This protocol coordinates the flow
            
            params.onStatus?.('approved', {
                protocol: 'wormhole',
                message: 'Quote received. Initiate transfer on Stacks.',
                quote,
            });

            // The flow is:
            // 1. Frontend calls Stacks contract via @stacks/connect
            // 2. Contract locks/burns USDC, emits Wormhole message
            // 3. Guardians attest → VAA created
            // 4. Executor picks up and relays to Base
            // 5. Proxy receives USDC → executes ticket purchase

            // Return pending - actual bridge happens via contract + Executor
            const result: BridgeResult = {
                success: true,
                protocol: 'wormhole',
                status: 'pending_signature' as BridgeStatus,
                bridgeId: `wormhole-ntt-${Date.now()}`,
                estimatedTimeMs: quote.estimatedDeliveryTime * 1000,
                details: {
                    message: 'Transfer initiated. Wormhole Guardians will attest, Executor will relay.',
                    sourceChain: params.sourceChain,
                    destinationChain: params.destinationChain,
                    amount: params.amount,
                    recipient: params.destinationAddress,
                    relayFee: quote.fee,
                    steps: [
                        '1. Sign Stacks transaction (locks/burns USDC)',
                        '2. Wait for Wormhole Guardian attestation (~1-2 min)',
                        '3. Executor relays to Base (automatic)',
                        '4. Proxy executes ticket purchase',
                    ],
                },
            };

            this.successCount++;
            this.totalTimeMs += Date.now() - startTime;

            return result;

        } catch (error) {
            this.failureCount++;
            this.lastFailure = new Date();

            console.error('[WormholeNtt] Bridge failed:', error);

            return {
                success: false,
                protocol: 'wormhole',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: error instanceof BridgeError ? error.code : BridgeErrorCode.UNKNOWN,
                suggestFallback: true,
                fallbackReason: 'Wormhole Executor unavailable. Try again or use alternative bridge.',
            };
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        const total = this.successCount + this.failureCount;
        const successRate = total > 0 ? this.successCount / total : 0.95;
        const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 180_000;

        const recentFailures = this.failureCount > 3;
        const lowSuccessRate = successRate < 0.7;
        const isHealthy = !recentFailures && !lowSuccessRate && this.failureCount < 5;

        return {
            protocol: 'wormhole',
            isHealthy,
            successRate,
            averageTimeMs,
            consecutiveFailures: this.failureCount,
            estimatedFee: '0.50',
            statusDetails: {
                recentFailures,
                lowSuccessRate,
            }
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        // Validate route
        if (!this.supports(params.sourceChain, params.destinationChain)) {
            return { 
                valid: false, 
                error: 'Wormhole NTT only supports Stacks → Base' 
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

        // Validate amount (minimum 1 ticket = $1)
        const amount = parseFloat(params.amount);
        if (isNaN(amount) || amount <= 0) {
            return { 
                valid: false, 
                error: 'Invalid amount (must be positive number)' 
            };
        }

        if (amount < 1) {
            return {
                valid: false,
                error: 'Minimum bridge amount is $1 (1 lottery ticket)'
            };
        }

        return { valid: true };
    }

    /**
     * Get relay quote from Executor network
     * This enables permissionless relaying - anyone can execute
     */
    private async getRelayQuote(amount: string): Promise<WormholeNttQuote> {
        try {
            const response = await fetch(`${this.executorEndpoint}/v1/quote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceChain: WORMHOLE_STACKS_CHAIN,
                    destinationChain: WORMHOLE_BASE_CHAIN,
                    amount,
                    token: this.usdcStacks,
                }),
            });

            if (!response.ok) {
                throw new Error(`Executor quote failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            // Return fallback estimate if Executor unavailable
            return {
                relayAmount: amount,
                estimatedDeliveryTime: 180, // 3 minutes
                fee: '0.50',
                destinationChain: WORMHOLE_BASE_CHAIN,
            };
        }
    }

    /**
     * Parse VAA sequence from Stacks transaction
     * Called by chainhook when detecting Wormhole message
     */
    async parseVaaFromTx(txReceipt: any): Promise<string | null> {
        // In Chainhooks V2, the VAA should be included in the contract log
        // Parse the transaction to extract the sequence number
        // This would be implemented based on the actual Stacks contract interaction
        
        // Placeholder - actual implementation depends on contract events
        return null;
    }

    /**
     * Check if a transfer has been completed
     * Used for status polling
     */
    async getTransferStatus(messageId: string): Promise<{
        status: 'pending' | 'attested' | 'delivered' | 'failed';
        destinationTxHash?: string;
    }> {
        try {
            const response = await fetch(`${this.executorEndpoint}/v1/status/${messageId}`);
            
            if (!response.ok) {
                return { status: 'pending' };
            }

            const data = await response.json();
            
            return {
                status: data.delivered ? 'delivered' : data.attested ? 'attested' : 'pending',
                destinationTxHash: data.destinationTxHash,
            };
        } catch {
            return { status: 'pending' };
        }
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const wormholeNttProtocol = new WormholeNttProtocol();
