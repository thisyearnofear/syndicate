/**
 * TON BRIDGE PROTOCOL
 *
 * Enables TON users to purchase Base Megapot tickets via TON Connect.
 * Flow: User pays USDT/TON to TON contract -> CCTP relay -> Base ticket minted.
 *
 * Principles:
 * - ENHANCEMENT: Adds TON capability to unified bridge system
 * - CLEAN: Encapsulates TON-specific logic
 * - DRY: Reuses shared types and config
 *
 * Status: PAUSED
 * The TON lottery contract is not yet deployed to mainnet. Until a real
 * `TON_LOTTERY_CONTRACT` (and optional `NEXT_PUBLIC_TON_LOTTERY_CONTRACT`
 * for client-side use) is provided, this protocol refuses all bridge calls
 * with a `PROTOCOL_DISABLED` error. To re-enable, deploy `contracts/ton/lottery.fc`
 * to TON mainnet and set the env var; no other code changes are required.
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

// TON lottery contract address. Read from env at module load. Empty string
// when the env var is unset, which puts the protocol in the "disabled" state.
const TON_LOTTERY_CONTRACT = process.env.TON_LOTTERY_CONTRACT?.trim() ?? '';
const TON_LOTTERY_CONTRACT_PUBLIC = process.env.NEXT_PUBLIC_TON_LOTTERY_CONTRACT?.trim() ?? '';

/** Returns true when the TON lottery contract env var is configured. */
export function isTonEnabled(): boolean {
    return TON_LOTTERY_CONTRACT.length > 0;
}

/** Returns the configured TON lottery contract address, or '' if disabled. */
export function getTonLotteryContract(): string {
    return TON_LOTTERY_CONTRACT;
}

/** Returns the client-side TON lottery contract address, or '' if disabled. */
export function getTonLotteryContractPublic(): string {
    return TON_LOTTERY_CONTRACT_PUBLIC;
}

/** Throws PROTOCOL_DISABLED unless the TON lottery contract is configured. */
function assertTonEnabled(): void {
    if (!isTonEnabled()) {
        throw new BridgeError(
            BridgeErrorCode.PROTOCOL_DISABLED,
            'TON bridge is paused. Set TON_LOTTERY_CONTRACT (and NEXT_PUBLIC_TON_LOTTERY_CONTRACT for client use) to re-enable after the TON lottery contract is deployed to mainnet.',
            'ton',
        );
    }
}

export class TonProtocol implements BridgeProtocol {
    readonly name = 'ton' as const;

    // Health tracking
    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    // ============================================================================
    // BridgeProtocol Interface Implementation
    // ============================================================================

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        if (!isTonEnabled()) return false;
        return sourceChain === 'ton' && destinationChain === 'base';
    }

    async estimate(params: BridgeParams) {
        void params;
        assertTonEnabled();
        return {
            fee: '0.10', // ~$0.10 in TON gas + relay fees
            timeMs: 180_000, // ~3 minutes for TON confirmation + CCTP relay
            gasEstimate: '~0.05 TON',
        };
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        const startTime = Date.now();
        const { amount, destinationAddress, onStatus } = params;

        try {
            onStatus?.('validating', { protocol: 'ton' });

            // Guard: TON protocol is paused until the lottery contract is deployed
            assertTonEnabled();

            // Validate destination address is valid EVM format
            if (!destinationAddress || !destinationAddress.startsWith('0x') || destinationAddress.length !== 42) {
                throw new BridgeError(
                    BridgeErrorCode.INVALID_ADDRESS,
                    'Destination address must be a valid EVM address (0x...)',
                    'ton'
                );
            }

            // Return pending_signature — user needs to sign via TON Connect
            // The actual execution happens in useUnifiedPurchase -> handleTonWalletSign
            const result: BridgeResult = {
                success: false, // Not successful until user signs and tx confirms
                protocol: 'ton',
                status: 'pending_signature' as BridgeStatus,
                bridgeId: `ton-cctp-${Date.now()}`,
                estimatedTimeMs: 180_000,
                details: {
                    message: 'Sign transaction in TON Connect to initiate CCTP bridging to Base.',
                    sourceChain: params.sourceChain,
                    destinationChain: params.destinationChain,
                    amount: params.amount,
                    recipient: destinationAddress,
                    walletAction: {
                        type: 'ton_contract_call',
                        contractAddress: TON_LOTTERY_CONTRACT,
                        token: params.token || 'USDT',
                        ticketCount: amount,
                        baseAddress: destinationAddress,
                    },
                    steps: [
                        '1. Sign TON transaction (pays USDT/TON to lottery contract)',
                        '2. Contract emits bridge intent event',
                        '3. CCTP relayer detects event and mints USDC on Base',
                        '4. Megapot contract executes ticket purchase',
                    ],
                },
            };

            void startTime;
            return result;

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
        const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 180_000;

        // Disabled protocol reports as unhealthy so the bridge index skips it
        if (!isTonEnabled()) {
            return {
                protocol: 'ton',
                isHealthy: false,
                successRate: 0,
                averageTimeMs: 0,
                consecutiveFailures: 0,
                estimatedFee: '0.00',
                statusDetails: {
                    disabled: true,
                    reason: 'TON_LOTTERY_CONTRACT env var is not configured. Protocol is paused.',
                },
            };
        }

        // Check TON RPC health
        let isHealthy = true;
        try {
            const response = await fetch('https://toncenter.com/api/v2/getMasterchainInfo', {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            isHealthy = response.ok;
        } catch {
            isHealthy = false;
        }

        return {
            protocol: 'ton',
            isHealthy,
            successRate,
            averageTimeMs,
            consecutiveFailures: this.failureCount,
            estimatedFee: '0.10',
            statusDetails: {
                recentFailures: this.failureCount > 3,
            }
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        if (!isTonEnabled()) {
            return { valid: false, error: 'TON bridge is paused (TON_LOTTERY_CONTRACT not configured).' };
        }
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

export const tonProtocol = new TonProtocol();
