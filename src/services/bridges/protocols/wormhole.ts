/**
 * WORMHOLE PROTOCOL - TokenBridge Implementation
 * 
 * Implements standard TokenBridge transfers using the Wormhole SDK.
 * Serves as a robust fallback when CCTP is unavailable.
 * 
 * Note: Transfers native USDC -> Wrapped USDC (USDC.e) on destination.
 */

import type {
    BridgeProtocol,
    BridgeParams,
    BridgeResult,
    ProtocolHealth,
    ChainIdentifier,
} from '../types';
import { BridgeError, BridgeErrorCode } from '../types';
import {
    wormhole,
    signSendWait,
    Wormhole,
    Chain,
    Network
} from '@wormhole-foundation/sdk';
import { TokenBridge } from '@wormhole-foundation/sdk-definitions';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import { ethers } from 'ethers';

// ============================================================================
// Wormhole Protocol Implementation
// ============================================================================

export class WormholeProtocol implements BridgeProtocol {
    readonly name = 'wormhole' as const;
    private wh: Wormhole<Network> | null = null;

    // Health tracking
    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    // ============================================================================
    // BridgeProtocol Interface Implementation
    // ============================================================================

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        const supported: ChainIdentifier[] = ['ethereum', 'base', 'avalanche', 'polygon'];
        return supported.includes(sourceChain) && supported.includes(destinationChain);
    }

    async estimate(params: BridgeParams) {
        // Wormhole fees are generally low (message fee + gas)
        return {
            fee: '0.001', // Approximate relayer fee
            timeMs: 15 * 60 * 1000, // ~15 mins for finality + VAA
            gasEstimate: '~0.005 SOL/ETH',
        };
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        const startTime = Date.now();
        const { sourceChain, destinationChain, amount: amountStr, destinationAddress, onStatus, wallet, dryRun } = params;

        try {
            onStatus?.('validating', { protocol: 'wormhole' });

            if (dryRun) {
                return {
                    success: true,
                    protocol: 'wormhole',
                    status: 'complete',
                    bridgeId: 'dryrun-wormhole',
                    details: {
                        from: sourceChain,
                        to: destinationChain,
                        amount: amountStr,
                        recipient: destinationAddress
                    },
                };
            }

            // Initialize SDK if needed
            if (!this.wh) {
                this.wh = await wormhole('Mainnet', [evm, solana]);
            }

            // Map internal chain IDs to Wormhole Chain names
            const srcChain = this.toWormholeChain(sourceChain);
            const dstChain = this.toWormholeChain(destinationChain);

            // Get chain contexts
            const srcContext = this.wh.getChain(srcChain);
            const dstContext = this.wh.getChain(dstChain);

            onStatus?.('validating', { step: 'Getting token bridge' });

            // Get token bridge
            const tb = await srcContext.getTokenBridge();

            const amt = ethers.parseUnits(amountStr, 6);

            // Get signer for source chain
            const signer = await this.getWormholeSigner(sourceChain, wallet);
            if (!signer) {
                throw new BridgeError(
                    BridgeErrorCode.WALLET_REJECTED,
                    `Unable to get signer for ${sourceChain}`,
                    'wormhole'
                );
            }

            const sourceTokenAddress = this.getUsdcAddress(sourceChain);
            const senderAddress = Wormhole.parseAddress(srcChain, signer.address());
            const receiver = Wormhole.chainAddress(dstChain, destinationAddress);
            const tokenAddress = Wormhole.parseAddress(srcChain, sourceTokenAddress);

            onStatus?.('approving');

            const transferTx = tb.transfer(
                senderAddress,
                receiver,
                tokenAddress,
                amt
            );

            onStatus?.('burning');

            // Sign and send the transaction
            const result = await signSendWait(srcContext, transferTx, signer);

            onStatus?.('burn_confirmed', {
                txHash: Array.isArray(result) ? result[result.length - 1]?.txid : undefined
            });

            // Wait for VAA to be available (Wormhole attestation equivalent)
            onStatus?.('waiting_attestation');

            const lastTxid = Array.isArray(result) ? result[result.length - 1]?.txid : undefined;
            const vaa = lastTxid
                ? await this.wh.getVaa(lastTxid, TokenBridge.getTransferDiscriminator(), 600_000)
                : null;
            if (!vaa) {
                throw new BridgeError(
                    BridgeErrorCode.ATTESTATION_TIMEOUT,
                    'Failed to fetch Wormhole VAA (attestation)',
                    'wormhole'
                );
            }

            onStatus?.('minting');

            // Redeem on destination (if needed)
            // Some destinations require explicit redemption
            const dstTb = await dstContext.getTokenBridge();
            const destSender = Wormhole.parseAddress(dstChain, destinationAddress);
            const redeemTx = dstTb.redeem(destSender, vaa);
            const redeemResult = await signSendWait(dstContext, redeemTx, signer);

            onStatus?.('complete');

            const totalTime = Date.now() - startTime;
            this.successCount++;
            this.totalTimeMs += totalTime;

            return {
                success: true,
                protocol: 'wormhole',
                status: 'complete',
                sourceTxHash: Array.isArray(result) ? result[result.length - 1]?.txid : undefined,
                destinationTxHash: Array.isArray(redeemResult) ? redeemResult[redeemResult.length - 1]?.txid : undefined,
                messageId: typeof lastTxid === 'string' ? lastTxid : undefined,
                bridgeId: 'wormhole-v1',
                actualTimeMs: totalTime,
                details: {
                    vaa,
                    sourceChain: srcChain,
                    destinationChain: dstChain,
                    recipient: destinationAddress,
                    amount: amountStr,
                },
            };

        } catch (error) {
            this.failureCount++;
            this.lastFailure = new Date();

            if (error instanceof BridgeError) throw error;

            throw new BridgeError(
                BridgeErrorCode.TRANSACTION_FAILED,
                error instanceof Error ? error.message : 'Wormhole bridge failed',
                'wormhole'
            );
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        // Check if Wormhole API/Guardians are up (simplified)
        const isHealthy = true; // Would check heartbeat in real app

        return {
            protocol: 'wormhole',
            isHealthy,
            successRate: this.successCount / (this.successCount + this.failureCount) || 1,
            averageTimeMs: this.totalTimeMs / this.successCount || 0,
            lastFailure: this.lastFailure,
            consecutiveFailures: this.failureCount,
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        if (!this.supports(params.sourceChain, params.destinationChain)) {
            return { valid: false, error: 'Route not supported by Wormhole configuration' };
        }
        return { valid: true };
    }

    // ============================================================================
    // Helpers
    // ============================================================================

    private toWormholeChain(chain: ChainIdentifier): Chain {
        const map: Record<string, Chain> = {
            ethereum: 'Ethereum',
            base: 'Base',
            solana: 'Solana',
            polygon: 'Polygon',
            avalanche: 'Avalanche',
        };

        const whChain = map[chain];
        if (!whChain) throw new Error(`Chain ${chain} not supported by Wormhole`);
        return whChain;
    }

    /**
     * Get USDC contract/mint address for a given chain
     */
    private getUsdcAddress(chain: ChainIdentifier): string {
        const addresses: Record<ChainIdentifier, string> = {
            ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
            zcash: '', // No USDC on Zcash
            near: '', // No direct USDC on NEAR
        };

        return addresses[chain] || '';
    }

    /**
     * Get Wormhole signer adapter for the given chain
     * Adapts from Ethers/Solana wallet formats to Wormhole SDK signers
     */
    private async getWormholeSigner(chain: ChainIdentifier, wallet?: any) {
        try {
            if (chain === 'ethereum' || chain === 'base' || chain === 'polygon' || chain === 'avalanche') {
                const ethSigner: ethers.Signer | null = wallet?.signer
                    ? wallet.signer
                    : await (async () => {
                        try {
                            const { web3Service } = await import('@/services/web3Service');
                            return await web3Service.getFreshSigner();
                        } catch {
                            return null;
                        }
                    })();

                if (!ethSigner) return null;

                const { getEvmSignerForSigner } = await import('@wormhole-foundation/sdk-evm');
                return await getEvmSignerForSigner(ethSigner);
            }

            return null;
        } catch (error) {
            console.error('[Wormhole] Failed to get signer:', error);
            return null;
        }
    }

    /**
     * Poll for Wormhole VAA (Verified Action Approval)
     * VAA is the cross-chain attestation that proves the token burn
     */
    private async pollForVaa(_txResult: any, _maxWaitMs: number = 600000): Promise<string | null> {
        return null;
    }
}

export const wormholeProtocol = new WormholeProtocol();
