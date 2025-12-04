/**
 * NEAR CHAIN SIGNATURES PROTOCOL
 * 
 * Enables NEAR accounts to control EVM accounts via Chain Signatures (MPC).
 * Allows purchasing tickets on Base directly from NEAR.
 * 
 * Principles:
 * - ENHANCEMENT: Adds NEAR capability to unified bridge system
 * - CLEAN: Encapsulates MPC logic
 * - DRY: Reuses shared types and config
 */

import { ethers } from 'ethers';
import { JsonRpcProvider } from '@near-js/providers';
import type { WalletSelector } from '@near-wallet-selector/core';
import type {
    BridgeProtocol,
    BridgeParams,
    BridgeResult,
    ProtocolHealth,
    ChainIdentifier,
} from '../types';
import { BridgeError, BridgeErrorCode } from '../types';
import { NEAR, CONTRACTS, CHAINS } from '@/config';
import { DERIVATION_PATHS } from '@/config/nearConfig';
import {
    fetchNonceAndFees,
    buildUnsignedParams,
    computeUnsignedDigest,
    serializeSignedEip1559,
    bytesToBase64,
    type Eip1559Params
} from '@/services/evmTxBuilder';

// Lightweight type for NEAR wallet context
type NearWalletContext = {
    accountId: string;
    selector: WalletSelector;
};

// ============================================================================
// NEAR Chain Signatures Protocol Implementation
// ============================================================================

export class NearChainSigsProtocol implements BridgeProtocol {
    readonly name = 'near' as const;

    private nearProvider: JsonRpcProvider;
    private readonly signerContractId = NEAR.mpcContract;
    private readonly ONE_NEAR_YOCTO = "1000000000000000000000000";
    private readonly DEFAULT_KEY_VERSION = 1;
    private readonly DOMAIN_ID_SECP256K1 = 0;

    // Health tracking
    private successCount = 0;
    private failureCount = 0;
    private totalTimeMs = 0;
    private lastFailure?: Date;

    constructor() {
        this.nearProvider = new JsonRpcProvider({ url: NEAR.nodeUrl });
    }

    // ============================================================================
    // BridgeProtocol Interface Implementation
    // ============================================================================

    supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
        // Supports NEAR -> Base (via Chain Signatures)
        return sourceChain === 'near' && (destinationChain === 'base' || destinationChain === 'ethereum');
    }

    async estimate(params: BridgeParams) {
        void params;
        // NEAR Chain Signatures cost:
        // 1. NEAR gas for MPC request (~300 TGas)
        // 2. Base gas for transaction execution
        // 3. Relayer fee (if using relayer, currently self-relayed via RPC)

        return {
            fee: '0.05', // ~0.05 USD in NEAR for MPC
            timeMs: 60000, // ~60s for MPC signature + Base confirmation
            gasEstimate: '~0.01 NEAR + EVM Gas',
        };
    }

    async bridge(params: BridgeParams): Promise<BridgeResult> {
        const startTime = Date.now();
        const { destinationChain, amount, destinationAddress, onStatus, wallet } = params;

        try {
            // 1. Validate Wallet
            if (!wallet || typeof wallet !== 'object') {
                throw new BridgeError(
                    BridgeErrorCode.WALLET_REJECTED,
                    'NEAR wallet not connected',
                    'near'
                );
            }
            const walletObj = wallet as Record<string, unknown>;
            if (!walletObj.selector || !walletObj.accountId) {
                throw new BridgeError(
                    BridgeErrorCode.WALLET_REJECTED,
                    'NEAR wallet not properly initialized',
                    'near'
                );
            }
            const nearWallet = wallet as NearWalletContext;

            onStatus?.('validating', { protocol: 'near' });

            // 2. Derive EVM Address (to ensure we are signing for the right account)
            const derivedAddress = await this.getDerivedEvmAddress(nearWallet.accountId, destinationChain as 'base' | 'ethereum');
            if (!derivedAddress) {
                throw new BridgeError(
                    BridgeErrorCode.INVALID_ADDRESS,
                    'Failed to derive EVM address from NEAR account',
                    'near'
                );
            }
            onStatus?.('validating', { derivedAddress });

            // 3. Build Transaction
            // For "bridging", we are effectively executing a transaction on the destination chain
            // If destinationToken is defined, we might be transferring tokens.
            // If it's a purchase (implied by context), we call the contract.
            // For generic bridging, we'll assume a transfer of ETH/Native for now, 
            // OR if it's a specific contract call, we'd need that data.
            // Given the context of "Syndicate", this is likely for ticket purchase.
            // BUT, `BridgeProtocol` is generic.
            // We will assume a simple transfer of value (ETH) to the destination address if no data provided.
            // Wait, the `BridgeParams` doesn't have `data`.
            // If this is strictly for "Bridging Assets", then we are moving value.
            // But Chain Signatures is "Control".
            // For the hackathon, the use case is "Purchase Tickets on Base using NEAR".
            // So we will implement the specific logic for that if the destination is the Megapot contract.

            // Check if destination is Megapot
            const isMegapotPurchase = destinationAddress.toLowerCase() === CONTRACTS.megapot.toLowerCase();

            let data = '0x';
            let value = 0n;
            let to = destinationAddress;

            if (isMegapotPurchase) {
                // Specific logic for ticket purchase
                // const ticketCount = parseInt(amount);
                // BridgeParams says amount is "Decimal string".
                // If we are bridging USDC, we need to call `purchaseTickets`.
                // But wait, we need USDC on Base first.
                // The user flow is: NEAR User -> Chain Sig -> Base Account -> Purchase.
                // The Base Account needs USDC.
                // This is complex.
                // For now, let's implement the generic "Transfer ETH/Native" logic, 
                // which is the foundation. If the user wants to call a contract, 
                // we might need to extend `BridgeParams` or infer from context.

                // Let's stick to the existing `nearChainSignatureService` logic which was hardcoded for `purchaseTickets`.
                // We'll generalize it slightly: if `details.contractCall` is present, use it.
                // Otherwise, transfer native value.

                if (params.details?.contractCall) {
                    // Use provided call data
                    const contractCall = params.details.contractCall as { data?: string; value?: bigint; to?: string };
                    data = contractCall.data || '0x';
                    value = contractCall.value || 0n;
                    to = contractCall.to || destinationAddress;
                } else {
                    // Default: Transfer Native (ETH)
                    // Amount is in decimal (e.g. "0.1" ETH)
                    value = ethers.parseEther(amount);
                }
            } else {
                // Default transfer
                value = ethers.parseEther(amount);
            }

            // 4. Fetch Nonce & Fees
            onStatus?.('validating', { step: 'Building transaction' });
            const { nonce, baseFeePerGas, priorityFee } = await fetchNonceAndFees(derivedAddress);

            const unsignedParams: Eip1559Params = buildUnsignedParams({
                chainId: BigInt(CHAINS[destinationChain as keyof typeof CHAINS].id),
                to,
                data,
                value,
                gasLimit: 150000n, // TODO: Estimate gas
                nonce,
                baseFeePerGas,
                priorityFee,
            });

            // 5. Request Signature
            onStatus?.('approving', { step: 'Requesting MPC signature' });
            const digestBytes = computeUnsignedDigest(unsignedParams);
            // FIX: Pass payload as number array [u8; 32] instead of base64 string
            // This avoids potential validation issues in near-api-js or the contract
            const payloadArray = Array.from(digestBytes);

            const requestId = await this.requestChainSignatureChangeCall(
                nearWallet,
                DERIVATION_PATHS.ethereum,
                payloadArray
            );

            if (!requestId) {
                throw new BridgeError(
                    BridgeErrorCode.TRANSACTION_FAILED,
                    'Chain signature request failed',
                    'near'
                );
            }

            // 6. Poll for Signature
            onStatus?.('waiting_attestation', { step: 'Polling for signature' });
            const sig = await this.pollSignatureResult(requestId);

            if (!sig || sig.status !== 'COMPLETE' || !sig.r || !sig.s || typeof sig.v !== 'number') {
                throw new BridgeError(
                    BridgeErrorCode.ATTESTATION_TIMEOUT,
                    'Failed to obtain signature',
                    'near'
                );
            }

            // 7. Broadcast
            onStatus?.('minting', { step: 'Broadcasting transaction' });
            const raw = await serializeSignedEip1559(unsignedParams, { r: sig.r as `0x${string}`, s: sig.s as `0x${string}`, v: sig.v });
            const txHash = await this.relaySignedTransaction(raw, destinationChain as 'base' | 'ethereum');

            if (!txHash) {
                throw new BridgeError(
                    BridgeErrorCode.NETWORK_ERROR,
                    'Relayer broadcast failed',
                    'near'
                );
            }

            onStatus?.('complete', { txHash });

            // Update health
            this.successCount++;
            this.totalTimeMs += Date.now() - startTime;

            return {
                success: true,
                protocol: 'near',
                status: 'complete',
                destinationTxHash: txHash,
                bridgeId: `near-mpc-${requestId}`,
                details: { derivedAddress, requestId },
            };

        } catch (error) {
            this.failureCount++;
            this.lastFailure = new Date();
            if (error instanceof BridgeError) throw error;
            throw new BridgeError(
                BridgeErrorCode.TRANSACTION_FAILED,
                error instanceof Error ? error.message : 'NEAR bridge failed',
                'near'
            );
        }
    }

    async getHealth(): Promise<ProtocolHealth> {
        // Check if MPC contract is available (simple check)
        const isHealthy = NEAR.mpcContract === 'v1.signer';
        const total = this.successCount + this.failureCount;

        return {
            protocol: 'near',
            isHealthy,
            successRate: total > 0 ? this.successCount / total : 1,
            averageTimeMs: this.successCount > 0 ? this.totalTimeMs / this.successCount : 60000,
            lastFailure: this.lastFailure,
            consecutiveFailures: this.failureCount,
        };
    }

    async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
        if (!this.supports(params.sourceChain, params.destinationChain)) {
            return { valid: false, error: 'Route not supported by NEAR Chain Signatures' };
        }
        return { valid: true };
    }

    // ============================================================================
    // Internal Helpers
    // ============================================================================

    private async getDerivedEvmAddress(accountId: string, chain: 'base' | 'ethereum'): Promise<string | null> {
        void chain;
        try {
            const path = DERIVATION_PATHS.ethereum;
            const args = { path, key_version: this.DEFAULT_KEY_VERSION };
            const res: unknown = await this.nearProvider.query({
                request_type: 'call_function',
                account_id: this.signerContractId,
                method_name: 'public_key_for',
                args_base64: this.toBase64(args),
                finality: 'final',
            });

            const r = res as { result?: unknown };
            if (r.result) {
                // Result should be array-like data from NEAR RPC
                const resultData = r.result instanceof Uint8Array || r.result instanceof ArrayBuffer || ArrayBuffer.isView(r.result)
                    ? r.result as Uint8Array | ArrayBuffer | ArrayLike<number>
                    : new Uint8Array(0); // Fallback to empty array
                const decoded = this.decodeResult(resultData);
                const resp = typeof decoded === 'string' ? decoded : String(decoded);
                const [scheme, base64Pub] = resp.split(':');
                if (scheme !== 'secp256k1' || !base64Pub) return null;

                // Compute address from public key
                const bytes = this.fromBase64(base64Pub);
                let pubHex: string | null = null;
                if (bytes.length === 64) {
                    pubHex = ethers.hexlify(new Uint8Array([4, ...Array.from(bytes)]));
                } else if (bytes.length === 65 && bytes[0] === 4) {
                    pubHex = ethers.hexlify(bytes);
                } else {
                    return null;
                }
                return ethers.computeAddress(pubHex);
            }
            return null;
        } catch (e) {
            console.warn('[NEAR] Address derivation failed:', e);
            return null;
        }
    }

    private async requestChainSignatureChangeCall(
        wallet: NearWalletContext,
        path: string,
        payload: number[] | string
    ): Promise<string | null> {
        try {
            const w = await wallet.selector.wallet();
            const args = {
                payload,
                path,
                domain_id: this.DOMAIN_ID_SECP256K1,
                key_version: this.DEFAULT_KEY_VERSION,
            };

            try {
                const outcome = await w.signAndSendTransaction({
                    signerId: wallet.accountId,
                    receiverId: this.signerContractId,
                    actions: [{
                        type: 'FunctionCall',
                        params: {
                            methodName: 'sign',
                            args,
                            gas: '300000000000000', // 300 TGas
                            deposit: this.ONE_NEAR_YOCTO,
                        },
                    }],
                } as any);

                const oc = outcome as unknown as Record<string, unknown>;
                const txo = oc.transaction_outcome as { id?: string } | undefined;
                const tx = oc.transaction as { hash?: string } | undefined;
                return txo?.id || tx?.hash || null;
            } catch (innerError) {
                console.error('[NEAR] Wallet signAndSendTransaction failed:', innerError);
                throw innerError; // Re-throw to be caught by outer catch
            }
        } catch (e) {
            console.warn('[NEAR] Sign request failed:', e);
            return null;
        }
    }

    private async pollSignatureResult(requestId: string, timeoutMs = 60000): Promise<{ status: string; r?: string; s?: string; v?: number } | null> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const res: unknown = await this.nearProvider.query({
                    request_type: 'call_function',
                    account_id: this.signerContractId,
                    method_name: 'get_signature_result',
                    args_base64: this.toBase64({ request_id: requestId }),
                    finality: 'final',
                });
                const r = res as { result?: unknown };
                if (r.result) {
                    // Result should be array-like data from NEAR RPC
                    const resultData = r.result instanceof Uint8Array || r.result instanceof ArrayBuffer || ArrayBuffer.isView(r.result)
                        ? r.result as Uint8Array | ArrayBuffer | ArrayLike<number>
                        : new Uint8Array(0); // Fallback to empty array
                    const decoded = this.decodeResult(resultData);
                    const parsed = JSON.parse(decoded);
                    if (parsed?.status === 'COMPLETE' || parsed?.status === 'FAILED') {
                        return parsed;
                    }
                }
            } catch { }
            await new Promise(r => setTimeout(r, 2000));
        }
        return null;
    }

    private async relaySignedTransaction(signedTx: string, chain: 'base' | 'ethereum'): Promise<string | null> {
        try {
            const rpcUrl = CHAINS[chain].rpcUrl;
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const resp = await provider.send('eth_sendRawTransaction', [signedTx]);
            return typeof resp === 'string' ? resp : null;
        } catch (e) {
            console.warn('[NEAR] Relayer failed:', e);
            return null;
        }
    }

    private toBase64(obj: Record<string, unknown>): string {
        const json = JSON.stringify(obj);
        if (typeof window !== 'undefined' && typeof btoa === 'function') {
            return btoa(unescape(encodeURIComponent(json)));
        }
        return Buffer.from(json).toString('base64');
    }

    private fromBase64(b64: string): Uint8Array {
        if (typeof window !== 'undefined' && typeof atob === 'function') {
            const bin = atob(b64);
            return new Uint8Array(Array.from(bin).map(c => c.charCodeAt(0)));
        }
        return Uint8Array.from(Buffer.from(b64, 'base64'));
    }

    private decodeResult(result: Uint8Array | ArrayBuffer | ArrayLike<number>): string {
        try {
            const uint = result instanceof Uint8Array ? result : new Uint8Array(result);
            if (typeof window !== 'undefined') return new TextDecoder().decode(uint);
            return Buffer.from(uint).toString();
        } catch {
            return '';
        }
    }
}

export const nearProtocol = new NearChainSigsProtocol();
