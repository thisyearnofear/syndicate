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

/**
 * starknet.js-style call shape consumed by
 * useUnifiedPurchase.handleStarknetWalletSign (account.execute(calls)).
 */
export interface StarknetCall {
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
}

/**
 * Relayer deposit address that receives the user's tokens on Starknet;
 * the relayer settles the equivalent USDC purchase on Base.
 * Orbiter-style flow: transfer to a known maker/relayer address, relayer
 * detects it and fulfills the Base leg. Configured per environment.
 */
function getRelayerDepositAddress(): string | undefined {
    return process.env.NEXT_PUBLIC_STARKNET_BRIDGE_DEPOSIT_ADDRESS;
}

/** Convert a human token amount to raw base units (USDC: 6 dp, STRK: 18 dp). */
function toRawUnits(amount: string, decimals: number): bigint {
    const [whole, frac = ''] = amount.split('.');
    const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
    const scaled = BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fracPadded || '0');
    return scaled;
}

/** Cairo u256 → (low, high) felts as expected by starknet.js calldata. */
function toU256Calldata(raw: bigint): [string, string] {
    const MASK_128 = (1n << 128n) - 1n;
    return [(raw & MASK_128).toString(), (raw >> 128n).toString()];
}

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
            if (!tokenAddress) {
                return {
                    success: false,
                    protocol: 'starknet',
                    status: 'failed',
                    error: 'No Starknet token contract configured for this route.',
                    errorCode: BridgeErrorCode.UNSUPPORTED_ROUTE,
                };
            }
            const isStrk = tokenAddress === STRK_ADDRESSES.starknet;

            // The transfer leg targets the relayer's deposit address. Without
            // it there is no counterparty to settle the Base leg, so fail
            // closed instead of returning a pending_signature the user could
            // never complete.
            const depositAddress = getRelayerDepositAddress();
            if (!depositAddress) {
                return {
                    success: false,
                    protocol: 'starknet',
                    status: 'failed',
                    error:
                        'Starknet → Base bridge is not available: relayer deposit address is not configured ' +
                        '(NEXT_PUBLIC_STARKNET_BRIDGE_DEPOSIT_ADDRESS). Route will be enabled once the relayer is deployed.',
                    errorCode: BridgeErrorCode.PROTOCOL_UNAVAILABLE,
                };
            }

            // Build the real wallet call the user will sign: transfer tokens
            // to the relayer deposit address. USDC is 6 dp, STRK is 18 dp.
            const rawAmount = toRawUnits(amount, isStrk ? 18 : 6);
            const [amountLow, amountHigh] = toU256Calldata(rawAmount);
            const calls: StarknetCall[] = [
                {
                    contractAddress: tokenAddress,
                    entrypoint: 'transfer',
                    calldata: [depositAddress, amountLow, amountHigh],
                },
            ];

            // Return pending_signature — user needs to sign via Starknet wallet (ArgentX/Braavos)
            // The actual execution happens in useUnifiedPurchase -> handleStarknetWalletSign
            const result: BridgeResult = {
                success: false,
                protocol: 'starknet',
                status: 'pending_signature' as BridgeStatus,
                bridgeId: `starknet-bridge-${Date.now()}`,
                estimatedTimeMs: 240_000,
                details: {
                    message: `Sign transaction in your Starknet wallet to transfer ${isStrk ? 'STRK' : 'USDC'} to the bridge relayer, which settles your purchase on Base.`,
                    sourceChain: params.sourceChain,
                    destinationChain: params.destinationChain,
                    amount: params.amount,
                    recipient: destinationAddress,
                    calls,
                    walletAction: {
                        type: 'starknet_contract_call',
                        tokenAddress: tokenAddress,
                        amount: amount,
                        baseAddress: destinationAddress,
                        relayerDepositAddress: depositAddress,
                    },
                    steps: [
                        '1. Sign Starknet transaction (transfers tokens to bridge relayer)',
                        '2. Bridge relayer detects transfer',
                        '3. Relayer mints/sends equivalent USDC on Base',
                        '4. Megapot contract executes ticket purchase',
                    ],
                    note: isStrk
                        ? 'Relayer converts STRK to USDC on settlement; the final ticket amount depends on the swap rate at settlement time.'
                        : undefined,
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
