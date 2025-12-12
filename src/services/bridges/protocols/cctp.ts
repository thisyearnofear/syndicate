/**
 * CCTP PROTOCOL - Consolidated Implementation
 * 
 * Consolidates CCTP logic from:
 * - bridgeService.ts (EVM → Base)
 * - solanaBridgeService.ts (Solana → Base)
 * 
 * Principles:
 * - DRY: Single attestation logic (no duplication)
 * - CLEAN: Separation of EVM vs Solana specifics
 * - MODULAR: Implements BridgeProtocol interface
 */

import { ethers, Contract } from 'ethers';
import { Buffer } from 'buffer';
import type {
    BridgeProtocol,
    BridgeParams,
    BridgeResult,
    ProtocolHealth,
    ChainIdentifier,
} from '../types';
import { BridgeError, BridgeErrorCode } from '../types';
import { CONTRACTS, cctp as CCTP } from '@/config';
import CCTP_CONFIG from '@/config/cctpConfig';
import { pollWithBackoff, validateConnection } from '@/utils/asyncRetryHelper';

// ============================================================================
// CCTP Protocol Implementation
// ============================================================================

export class CctpProtocol implements BridgeProtocol {
    readonly name = 'cctp' as const;

    // ABIs
    private readonly ERC20_ABI = [
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function balanceOf(address account) external view returns (uint256)',
        'function allowance(address owner, address spender) external view returns (uint256)'
    ];

    private readonly TOKEN_MESSENGER_ABI = [
        'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64 nonce)'
    ];

    private readonly MESSAGE_TRANSMITTER_ABI = [
        'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)'
    ];

    // Health tracking
    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    // ============================================================================
    // BridgeProtocol Interface Implementation
    // ============================================================================

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        // CCTP supports: Ethereum → Base only (Solana handled by NEAR Intents)
        if (destinationChain !== 'base') return false;
        return sourceChain === 'ethereum'; // Solana removed for consolidation
    }

    async estimate(params: BridgeParams) {
        // CCTP fees are minimal (gas only)
        const isEvm = params.sourceChain === 'ethereum';

        return {
            fee: isEvm ? '0.01' : '0.001', // USD estimate
            timeMs: 15 * 60 * 1000, // 15 minutes for attestation
            gasEstimate: isEvm ? '~0.001 ETH' : '~0.0001 SOL',
        };
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        const startTime = Date.now();

        try {
            let result: BridgeResult;

            if (params.sourceChain === 'ethereum') {
                result = await this.bridgeFromEvm(params);
            } else if (params.sourceChain === 'solana') {
                result = await this.bridgeFromSolana(params);
            } else {
                throw new BridgeError(
                    BridgeErrorCode.UNSUPPORTED_ROUTE,
                    `CCTP doesn't support ${params.sourceChain} → ${params.destinationChain}`,
                    'cctp'
                );
            }

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

            throw error;
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        const total = this.successCount + this.failureCount;
        const successRate = total > 0 ? this.successCount / total : 0.95; // Assume 95% if no data
        const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 900_000; // 15 min default

        // More conservative health check - mark unhealthy sooner if recent failures
        const recentFailures = this.failureCount > 3;
        const lowSuccessRate = successRate < 0.6;
        const isHealthy = !recentFailures && !lowSuccessRate && this.failureCount < 5;

        return {
            protocol: 'cctp',
            isHealthy,
            successRate,
            averageTimeMs,
            lastFailure: this.lastFailure,
            consecutiveFailures: this.failureCount,
            estimatedFee: '0.01',
            // Add more detailed status information
            statusDetails: {
                recentFailures,
                lowSuccessRate,
                lastSuccessTime: this.successCount > 0 ? new Date() : null,
            }
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        if (!this.supports(params.sourceChain, params.destinationChain)) {
            return { valid: false, error: `CCTP doesn't support ${params.sourceChain} → ${params.destinationChain}` };
        }

        if (!params.destinationAddress || !params.destinationAddress.startsWith('0x')) {
            return { valid: false, error: 'Destination address must be valid EVM address (0x...)' };
        }

        if (params.destinationAddress.length !== 42) {
            return { valid: false, error: 'Invalid EVM address length' };
        }

        const amount = parseFloat(params.amount);
        if (isNaN(amount) || amount <= 0) {
            return { valid: false, error: 'Invalid amount' };
        }

        return { valid: true };
    }

    // ============================================================================
    // EVM Bridge Implementation (Ethereum → Base)
    // ============================================================================

    private async bridgeFromEvm(params: BridgeParams): Promise<BridgeResult> {
        const { amount, destinationAddress, onStatus, wallet, dryRun } = params;

        // Get provider/signer
        const walletTyped = wallet as { provider?: ethers.Provider; signer?: ethers.Signer } | undefined;
        const { provider, signer } = await this.getEvmProviderSigner(walletTyped);
        if (!signer || !provider) {
            throw new BridgeError(
                BridgeErrorCode.WALLET_REJECTED,
                'No signer available. Connect wallet first.',
                'cctp'
            );
        }

        const eth = CCTP.ethereum;
        const base = CCTP.base;

        onStatus?.('approve', { token: eth.usdc, amount });

        if (dryRun) {
            return {
                success: true,
                protocol: 'cctp',
                status: 'complete',
                bridgeId: 'dryrun-cctp-evm',
                details: { originToken: eth.usdc, destToken: base.usdc, recipient: destinationAddress },
            };
        }

        try {
            // 1. Approve USDC
            const usdc = new Contract(eth.usdc, this.ERC20_ABI, signer);
            const amountWei = ethers.parseUnits(amount, 6);
            const recipientBytes32 = ethers.zeroPadValue(destinationAddress, 32);

            const allowance = await usdc.allowance(await signer.getAddress(), eth.tokenMessenger);
            if (allowance < amountWei) {
                const txApprove = await usdc.approve(eth.tokenMessenger, amountWei);
                const rcApprove = await txApprove.wait();
                onStatus?.('approved', { txHash: rcApprove.hash });
            }

            // 2. Burn USDC on Ethereum
            const messenger = new Contract(eth.tokenMessenger, this.TOKEN_MESSENGER_ABI, signer);
            onStatus?.('burning', { destinationDomain: base.domain });

            const txBurn = await messenger.depositForBurn(amountWei, base.domain, recipientBytes32, eth.usdc);
            const rcBurn = await txBurn.wait();
            onStatus?.('burn_confirmed', { txHash: rcBurn.hash });

            // 3. Extract message from logs
            const message = await this.extractMessageFromEvmLogs(rcBurn.logs);
            if (!message || message === '0x') {
                throw new BridgeError(
                    BridgeErrorCode.TRANSACTION_FAILED,
                    'Failed to extract CCTP message from logs',
                    'cctp'
                );
            }

            // 4. Fetch attestation (CONSOLIDATED LOGIC)
            onStatus?.('waiting_attestation');
            const attestation = await this.fetchAttestation(message);
            if (!attestation) {
                throw new BridgeError(
                    BridgeErrorCode.ATTESTATION_TIMEOUT,
                    'Failed to fetch CCTP attestation from Circle',
                    'cctp'
                );
            }

            onStatus?.('minting');

            // 5. Mint on Base - try automatic redemption if we have provider
            let mintTxHash: string | null = null;
            try {
                const baseProvider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
                const messageTransmitter = new Contract(base.messageTransmitter, this.MESSAGE_TRANSMITTER_ABI, baseProvider);

                // Check if we can get a signer for Base
                if (typeof window !== 'undefined' && ('ethereum' in window)) {
                    const baseSigner = await this.getEvmProviderSigner(wallet as { provider?: ethers.Provider; signer?: ethers.Signer } | undefined);
                    if (baseSigner.signer) {
                        const transmitterWithSigner = messageTransmitter.connect(baseSigner.signer);
                        const receiveMessage = transmitterWithSigner.getFunction('receiveMessage');
                        const mintTx = await receiveMessage(message, attestation);
                        const mintReceipt = await mintTx.wait();
                        mintTxHash = mintReceipt.hash;
                        onStatus?.('complete', { mintTxHash });
                    }
                }
            } catch (mintError) {
                console.warn('[CCTP] Automatic Base minting failed, returning attestation for manual redemption:', mintError);
                onStatus?.('minting', {
                    message,
                    attestation,
                    requiresManualMint: true,
                });
            }

            return {
                success: true,
                protocol: 'cctp',
                status: mintTxHash ? 'complete' : 'minting',
                sourceTxHash: rcBurn.hash,
                destinationTxHash: mintTxHash || undefined,
                bridgeId: 'cctp-evm-v2',
                details: {
                    burnTxHash: rcBurn.hash,
                    message,
                    attestation,
                    recipient: destinationAddress,
                    mintTxHash: mintTxHash || undefined,
                    requiresManualMint: !mintTxHash,
                },
            };

        } catch (error) {
            this.failureCount++;
            this.lastFailure = new Date();

            if (error instanceof BridgeError) {
                // For attestation timeouts, suggest fallback
                if (error.code === BridgeErrorCode.ATTESTATION_TIMEOUT) {
                    return {
                        success: false,
                        protocol: 'cctp',
                        status: 'failed',
                        error: error.message,
                        errorCode: error.code,
                        suggestFallback: true,
                        fallbackReason: 'CCTP attestation delays - Wormhole may be faster'
                    };
                }
                throw error; // Re-throw other bridge errors
            }

            const errorMsg = (error as { message?: string })?.message || String(error);
            console.error('[CCTP EVM] Bridge failed:', errorMsg);

            // Enhanced error classification
            let classifiedError = BridgeErrorCode.TRANSACTION_FAILED;
            let userMessage = errorMsg;
            let suggestFallback = false;
            let fallbackReason = '';

            // Classify common errors
            if (errorMsg.includes('timeout') || errorMsg.includes('Time-out')) {
                classifiedError = BridgeErrorCode.TRANSACTION_TIMEOUT;
                userMessage = 'Transaction timed out. Network may be congested.';
                suggestFallback = true;
                fallbackReason = 'Network congestion - alternative protocol may work better';
            } else if (errorMsg.includes('insufficient funds') || errorMsg.includes('not enough')) {
                classifiedError = BridgeErrorCode.INSUFFICIENT_FUNDS;
                userMessage = 'Insufficient funds for gas fees.';
            } else if (errorMsg.includes('user rejected') || errorMsg.includes('denied')) {
                classifiedError = BridgeErrorCode.WALLET_REJECTED;
                userMessage = 'Transaction was rejected by user.';
            } else if (errorMsg.includes('nonce') || errorMsg.includes('replacement')) {
                classifiedError = BridgeErrorCode.NONCE_ERROR;
                userMessage = 'Nonce error - please check your wallet transaction queue.';
                suggestFallback = true;
                fallbackReason = 'Wallet transaction queue issue';
            }

            // Return failure instead of throwing to allow fallback
            return {
                success: false,
                protocol: 'cctp',
                status: 'failed',
                error: userMessage,
                errorCode: classifiedError,
                suggestFallback,
                fallbackReason,
                rawError: errorMsg // Keep original for debugging
            };
        }
    }

    // ============================================================================
    // Solana Bridge Implementation (Solana → Base)
    // ============================================================================

    private async bridgeFromSolana(params: BridgeParams): Promise<BridgeResult> {
        // AGGRESSIVE CONSOLIDATION: Solana bridge removed
        // Solana cross-chain transfers are handled by NEAR Intents
        // This prevents code duplication and follows single responsibility principle
        throw new BridgeError(
            BridgeErrorCode.PROTOCOL_UNAVAILABLE,
            'Solana bridge is not available. Use NEAR Intents for Solana cross-chain transfers.',
            'cctp'
        );
    }

    // ============================================================================
    // Shared Utilities (DRY - Single Implementation)
    // ============================================================================

    /**
     * Fetch CCTP attestation from Circle Iris API
     * CONSOLIDATED from both bridgeService.ts and solanaBridgeService.ts
     */
    private async fetchAttestation(message: string, options?: { timeoutMs?: number; retryDelayMs?: number }): Promise<string | null> {
        try {
            if (!message || message === '0x') return null;

            const msgHash = ethers.keccak256(message as string);
            const proxyUrl = `/api/attestation?messageHash=${msgHash}`;
            const directUrl = `https://iris-api.circle.com/v1/attestations/${msgHash}`;
            
            // Enhanced polling with multiple fallback strategies
            const attestation = await pollWithBackoff(
                async () => {
                    let resp: Response | null = null;
                    let json: any = null;

                    // Strategy 1: Try proxy first (avoids CORS)
                    try {
                        resp = await fetch(proxyUrl, { 
                            signal: AbortSignal.timeout(8000), 
                            headers: { 'Accept': 'application/json' }
                        });
                        
                        if (resp.ok) {
                            json = await resp.json().catch(() => null);
                        }
                    } catch (proxyError: unknown) {
                        console.debug('[CCTP] Proxy fetch failed, trying direct:', (proxyError as { message?: string })?.message || String(proxyError));
                    }

                    // Strategy 2: Fallback to direct Circle API
                    if (!json?.attestation) {
                        try {
                            resp = await fetch(directUrl, { 
                                signal: AbortSignal.timeout(8000),
                                headers: { 'Accept': 'application/json' }
                            });
                            
                            if (resp.ok) {
                                json = await resp.json().catch(() => null);
                            }
                        } catch (directError: unknown) {
                            console.debug('[CCTP] Direct fetch failed:', (directError as { message?: string })?.message || String(directError));
                        }
                    }

                    // Strategy 3: Alternative Circle endpoint (if available)
                    if (!json?.attestation && process.env.NEXT_PUBLIC_CCTP_FALLBACK_API) {
                        try {
                            const fallbackUrl = `${process.env.NEXT_PUBLIC_CCTP_FALLBACK_API}/attestations/${msgHash}`;
                            resp = await fetch(fallbackUrl, { 
                                signal: AbortSignal.timeout(8000),
                                headers: { 'Accept': 'application/json' }
                            });
                            
                            if (resp.ok) {
                                json = await resp.json().catch(() => null);
                            }
                        } catch (fallbackError: unknown) {
                            console.debug('[CCTP] Fallback API failed:', (fallbackError as { message?: string })?.message || String(fallbackError));
                        }
                    }

                    if (!json) return null;

                    const status = json?.status;
                    const att = json?.attestation;

                    // Check for complete attestation
                    if (status === 'complete' && typeof att === 'string' && att.startsWith('0x')) {
                        console.log('[CCTP] Attestation received successfully');
                        return att;
                    }

                    // Check for error states
                    if (status === 'failed' || json?.error) {
                        console.error('[CCTP] Attestation failed:', json?.error || 'Unknown error');
                        throw new BridgeError(
                            BridgeErrorCode.ATTESTATION_FAILED,
                            `CCTP attestation failed: ${json?.error || 'Unknown error'}`,
                            'cctp'
                        );
                    }

                    // Continue polling if still pending
                    console.debug('[CCTP] Attestation still pending, will retry...');
                    return null; // Keep polling
                },
                {
                    maxWaitMs: options?.timeoutMs || 900_000, // 15 minutes default (increased from 10)
                    initialDelayMs: options?.retryDelayMs || 2000, // Start faster
                    maxDelayMs: options?.retryDelayMs || 15000, // Longer max delay
                    backoffMultiplier: 1.3, // Slightly more aggressive backoff
                    context: 'Circle CCTP attestation',
                }
            );

            return attestation;
        } catch (error) {
            console.error('[CCTP] Attestation fetch failed:', error);
            
            if (error instanceof BridgeError) {
                throw error; // Re-throw known bridge errors
            }
            
            // Provide more context for timeout errors
            const errorMsg = (error as { message?: string })?.message || String(error);
            if ((error as { name?: string })?.name === 'TimeoutError' || errorMsg.includes('timeout')) {
                throw new BridgeError(
                    BridgeErrorCode.ATTESTATION_TIMEOUT,
                    'CCTP attestation timed out. Circle may be experiencing delays. Consider using an alternative bridge protocol.',
                    'cctp'
                );
            }
            
            return null;
        }
    }

    /**
     * Extract CCTP message from EVM transaction logs
     */
    private async extractMessageFromEvmLogs(logs: readonly ethers.Log[]): Promise<string> {
        const MESSAGE_SENT_TOPIC = ethers.id('MessageSent(bytes)');

        for (const log of logs) {
            if (log.topics && log.topics.length > 0 && log.topics[0] === MESSAGE_SENT_TOPIC) {
                const data = log.data as string;
                if (typeof data === 'string' && data.startsWith('0x') && data.length > 2) {
                    return data;
                }
            }
        }

        return '0x';
    }

    /**
     * Extract CCTP message from Solana transaction logs
     */
    private extractMessageFromSolanaLogs(logs: string[]): string | null {
        for (const log of logs) {
            if (log.startsWith('Program data: ')) {
                const base64Data = log.slice('Program data: '.length).trim();
                try {
                    const data = Buffer.from(base64Data, 'base64');
                    if (data.length >= 116) { // Minimum CCTP message size
                        return '0x' + data.toString('hex');
                    }
                } catch {
                    continue;
                }
            }
        }
        return null;
    }

    /**
     * Convert EVM address to 32-byte format for CCTP
     */
    private evmAddressToBytes32(evmAddress: string): Uint8Array {
        const addr = evmAddress.toLowerCase().replace('0x', '');
        const padded = addr.padStart(64, '0');
        return new Uint8Array(Buffer.from(padded, 'hex'));
    }

    private async anchorDiscriminator(name: string): Promise<Buffer> {
        const input = new TextEncoder().encode(`global:${name}`);
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            const digest = await window.crypto.subtle.digest('SHA-256', input.buffer as ArrayBuffer);
            const arr = new Uint8Array(digest).slice(0, 8);
            return Buffer.from(arr);
        }
        try {
            const crypto = await import('crypto');
            const h = crypto.createHash('sha256').update(input).digest();
            return Buffer.from(h.slice(0, 8));
        } catch {
            const arr = new Uint8Array(8);
            return Buffer.from(arr);
        }
    }

    /**
     * Convert u64 to Buffer (little-endian)
     */
    private u64ToBuffer(value: bigint): Buffer {
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64LE(value, 0);
        return buf;
    }

    /**
     * Convert u32 to Buffer (little-endian)
     */
    private u32ToBuffer(value: number): Buffer {
        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(value, 0);
        return buf;
    }

    /**
     * Get EVM provider and signer
     */
    private async getEvmProviderSigner(wallet?: { provider?: ethers.Provider; signer?: ethers.Signer }): Promise<{
        provider: ethers.Provider | null;
        signer: ethers.Signer | null;
    }> {
        if (wallet) {
            return { provider: wallet.provider ?? null, signer: wallet.signer ?? null };
        }

        // Try to get from web3Service
        try {
            const { web3Service } = await import('@/services/web3Service');
            return {
                provider: web3Service.getProvider(),
                signer: await web3Service.getFreshSigner().catch(() => null),
            };
        } catch {
            return { provider: null, signer: null };
        }
    }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const cctpProtocol = new CctpProtocol();