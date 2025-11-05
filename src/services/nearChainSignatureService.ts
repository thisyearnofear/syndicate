/**
 * NEAR CHAIN SIGNATURES SERVICE (Scaffold)
 *
 * Purpose: Provide an optional path for NEAR users to purchase tickets
 * on Base via Chain Signatures, without disrupting the existing EVM flow.
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Adds optional capability alongside existing flow
 * - AGGRESSIVE CONSOLIDATION: Centralizes NEAR-specific cross-chain logic
 * - PREVENT BLOAT: Minimal, focused scaffold; no redundant abstractions
 * - DRY: Reuses existing config and result types
 * - CLEAN: Clear separation from EVM web3Service
 * - MODULAR: Independent, composable service
 */

import type { TicketPurchaseResult } from '@/services/web3Service';
import { NEAR, CONTRACTS, CHAINS, LOTTERY } from '@/config';
import { ethers } from 'ethers';
import { JsonRpcProvider } from '@near-js/providers';
import type { WalletSelector } from '@near-wallet-selector/core';
import { DERIVATION_PATHS } from '@/config/nearConfig';
import { fetchNonceAndFees, buildUnsignedParams, computeUnsignedDigest, serializeSignedEip1559, bytesToBase64, type Eip1559Params } from '@/services/evmTxBuilder';

// Lightweight type for future NEAR wallet integration
type NearWalletContext = {
  accountId: string;
  // Additional NEAR wallet selector context can be added later
  selector?: WalletSelector;
};

class NearChainSignatureService {
  private initialized = false;
  private nearWallet: NearWalletContext | null = null;
  private nearProvider: JsonRpcProvider | null = null;
  private readonly signerContractId = NEAR.mpcContract;
  private readonly ONE_NEAR_YOCTO = "1000000000000000000000000";
  private readonly DEFAULT_KEY_VERSION = 1;
  private readonly DOMAIN_ID_SECP256K1 = 0;

  /**
   * Initialize with an optional NEAR wallet context
   */
  async initialize(wallet?: NearWalletContext): Promise<boolean> {
    this.nearWallet = wallet || null;
    this.nearProvider = new JsonRpcProvider({ url: NEAR.nodeUrl });
    // For now, we consider availability based on contract presence
    this.initialized = this.isChainSignatureAvailable();
    return this.initialized;
  }

  /**
   * Basic availability check: ensure MPC contract is set to v1.signer
   */
  isChainSignatureAvailable(): boolean {
    return NEAR.mpcContract === 'v1.signer';
  }

  /**
   * Derive an EVM address for a NEAR account on a target chain using `public_key_for`
   */
  async getDerivedEvmAddress(chain: 'base' | 'ethereum' | 'avalanche'): Promise<string | null> {
    if (!this.initialized || !this.nearWallet || !this.nearProvider) return null;

    try {
      const path = DERIVATION_PATHS.ethereum; // Base uses Ethereum derivation
      const args = { path, key_version: this.DEFAULT_KEY_VERSION };
      const res: any = await this.nearProvider.query({
        request_type: 'call_function',
        account_id: this.signerContractId,
        method_name: 'public_key_for',
        args_base64: this.toBase64(args),
        finality: 'final',
      });

      if (res.result) {
        const decoded = this.decodeResult(res.result);
        // Response is a string "secp256k1:<Base64 public key>"
        const resp = typeof decoded === 'string' ? decoded : String(decoded);
        const [scheme, base64Pub] = resp.split(':');
        if (scheme !== 'secp256k1' || !base64Pub) return null;
        const address = this.computeEvmAddressFromSecp256k1Base64(base64Pub);
        if (address) return address;
      }
      return null;
    } catch (error) {
      console.warn('Failed to derive EVM address via Chain Signatures:', error);
      return null;
    }
  }

  /**
   * Purchase tickets on Base using NEAR Chain Signatures (scaffold)
   * Keeps API aligned with existing web3Service.purchaseTickets
   */
  async purchaseTicketsOnBase(ticketCount: number, options?: { onStatus?: (stage: string, data?: any) => void }): Promise<TicketPurchaseResult> {
    // Guard: ensure NEAR wallet + chain signatures are ready
    if (!this.initialized || !this.nearWallet || !this.isChainSignatureAvailable()) {
      return {
        success: false,
        error: 'NEAR wallet not connected or Chain Signatures unavailable',
      };
    }

    try {
      // Build recipient from derived EVM address
      const recipient = await this.getDerivedEvmAddress('base');
      if (!recipient) {
        return { success: false, error: 'Failed to derive EVM address from NEAR account' };
      }
      options?.onStatus?.('deriving_address', { recipient });

      // Compute USDC amount from config ticket price
      const usdcAmount = LOTTERY.ticketPriceWei * BigInt(ticketCount);

      // Encode Megapot calldata
      const megapotAbi = [
        'function purchaseTickets(address referrer, uint256 value, address recipient) external',
      ];
      const iface = new ethers.Interface(megapotAbi);
      const data = iface.encodeFunctionData('purchaseTickets', [
        LOTTERY.referrerAddress,
        usdcAmount,
        recipient,
      ]);

      // Fetch nonce/fees for derived EVM address and build unsigned EIP-1559 params
      options?.onStatus?.('building_tx');
      const { nonce, baseFeePerGas, priorityFee } = await fetchNonceAndFees(recipient);
      const unsignedParams: Eip1559Params = buildUnsignedParams({
        chainId: BigInt(CHAINS.base.id),
        to: CONTRACTS.megapot,
        data,
        value: 0n,
        gasLimit: 150000n,
        nonce,
        baseFeePerGas,
        priorityFee,
      });
      options?.onStatus?.('tx_ready', { unsignedParams, baseFeePerGas, priorityFee, nonce });

      // Compute digest and request signature via v1.signer
      options?.onStatus?.('computing_digest');
      const digestBytes = computeUnsignedDigest(unsignedParams);
      const payloadB64 = bytesToBase64(digestBytes);
      options?.onStatus?.('requesting_signature');
      const requestId = await this.requestChainSignatureChangeCall(DERIVATION_PATHS.ethereum, payloadB64);
      if (!requestId) {
        return { success: false, error: 'Chain signature request failed (change call)' };
      }
      options?.onStatus?.('signature_requested', { requestId });

      // Poll for signature result (view-call)
      options?.onStatus?.('polling_signature');
      const sig = await this.pollSignatureResult(requestId, 30000);
      if (!sig || sig.status !== 'COMPLETE') {
        return { success: false, error: `Signature not ready: ${sig?.status || 'UNKNOWN'}` };
      }
      options?.onStatus?.('signature_complete', { r: sig.r, s: sig.s, v: sig.v });

      // Construct raw signed transaction from r,s,v and relay
      options?.onStatus?.('serializing_tx');
      const raw = await this.buildRawSignedTransaction(unsignedParams, sig);
      if (!raw) {
        return { success: false, error: 'Failed to construct raw signed transaction' };
      }
      options?.onStatus?.('broadcasting_tx');
      const txHash = await this.relaySignedTransaction(raw);
      if (!txHash) {
        return { success: false, error: 'Relayer broadcast failed' };
      }
      options?.onStatus?.('complete', { txHash });

      return { success: true, txHash, ticketCount };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'NEAR Chain Signatures purchase failed',
      };
    }
  }

  /**
   * Reset internal state
   */
  reset(): void {
    this.initialized = false;
    this.nearWallet = null;
  }

  /**
   * Helper: whether service is initialized
   */
  isReady(): boolean {
    return this.initialized;
  }

  // Request signature via change-call to v1.signer.sign
  private async requestChainSignatureChangeCall(
    derivationPath: string,
    payloadBase64: string
  ): Promise<string | null> {
    const selector = this.nearWallet?.selector;
    const accountId = this.nearWallet?.accountId;
    if (!selector || !accountId) {
      console.warn('NEAR Wallet Selector not available for change-call');
      return null;
    }
    try {
      const wallet = await selector.wallet();
      const args = {
        payload: payloadBase64,
        path: derivationPath,
        domain_id: this.DOMAIN_ID_SECP256K1,
        key_version: this.DEFAULT_KEY_VERSION,
      };

      const gas = String(300 * 10 ** 12); // 300 TGas
      const deposit = this.ONE_NEAR_YOCTO; // Typically 1 NEAR

      const outcome = await wallet.signAndSendTransaction({
        signerId: accountId,
        receiverId: this.signerContractId,
        actions: [
          {
            type: 'FunctionCall',
            params: {
              methodName: 'sign',
              args,
              gas,
              deposit,
            },
          },
        ],
      } as any);

      // Return request id or transaction hash for polling
      const txHash = (outcome as any)?.transaction_outcome?.id || (outcome as any)?.transaction?.hash || null;
      return txHash;
    } catch (error) {
      console.warn('Chain signature sign() change-call failed:', error);
      return null;
    }
  }

  private async pollSignatureResult(requestId: string, timeoutMs = 30000): Promise<{ status: 'PENDING' | 'COMPLETE' | 'FAILED'; r?: string; s?: string; v?: number } | null> {
    if (!this.nearProvider) return null;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res: any = await this.nearProvider.query({
          request_type: 'call_function',
          account_id: this.signerContractId,
          method_name: 'get_signature_result',
          args_base64: this.toBase64({ request_id: requestId }),
          finality: 'final',
        });
        if (res.result) {
          const decoded = this.decodeResult(res.result);
          const parsed = JSON.parse(decoded);
          if (parsed?.status === 'COMPLETE') {
            return { status: 'COMPLETE', r: parsed.r, s: parsed.s, v: parsed.v };
          }
          if (parsed?.status === 'FAILED') {
            return { status: 'FAILED' };
          }
        }
      } catch (e) {
        console.warn('Polling signature result failed:', e);
      }
      await this.sleep(1000);
    }
    return { status: 'PENDING' };
  }

  // Stub: relay a signed transaction to Base RPC
  private async relaySignedTransaction(signedTx: string): Promise<string | null> {
    try {
      // Broadcast via Base RPC; expecting raw signed tx hex string
      const provider = new ethers.JsonRpcProvider(CHAINS.base.rpcUrl);
      const resp = await provider.send('eth_sendRawTransaction', [signedTx]);
      return typeof resp === 'string' ? resp : null;
    } catch (error) {
      console.warn('Relayer broadcast failed:', error);
      return null;
    }
  }

  private async buildRawSignedTransaction(
    params: Eip1559Params,
    sig: { r?: string; s?: string; v?: number }
  ): Promise<string | null> {
    try {
      if (!sig.r || !sig.s || typeof sig.v !== 'number') return null;
      const raw = serializeSignedEip1559(params, { r: sig.r as `0x${string}`, s: sig.s as `0x${string}`, v: sig.v });
      return raw;
    } catch (e) {
      console.warn('Failed to build raw signed tx:', e);
      return null;
    }
  }

  // Browser-safe JSON -> base64
  private toBase64(obj: any): string {
    const json = JSON.stringify(obj);
    if (typeof window !== 'undefined' && typeof btoa === 'function') {
      // Encode UTF-8 properly
      return btoa(unescape(encodeURIComponent(json)));
    }
    // Node environment
    return Buffer.from(json).toString('base64');
  }

  // Decode Uint8Array/ArrayBuffer to string in both envs
  private decodeResult(result: Uint8Array | ArrayBuffer | any): string {
    try {
      const uint = result instanceof Uint8Array ? result : new Uint8Array(result);
      if (typeof window !== 'undefined') {
        return new TextDecoder().decode(uint);
      }
      return Buffer.from(uint).toString();
    } catch {
      // Fallback to direct toString if already string
      return typeof result === 'string' ? result : '';
    }
  }

  private computeEvmAddressFromSecp256k1Base64(base64Pub: string): string | null {
    try {
      const bytes = this.fromBase64(base64Pub);
      let pubHex: string | null = null;
      if (bytes.length === 64) {
        pubHex = ethers.hexlify(new Uint8Array([4, ...Array.from(bytes)]));
      } else if (bytes.length === 65 && bytes[0] === 4) {
        pubHex = ethers.hexlify(bytes);
      } else if (bytes.length === 33 && (bytes[0] === 2 || bytes[0] === 3)) {
        console.warn('Compressed public key not supported in scaffold');
        return null;
      } else {
        console.warn('Unexpected public key format');
        return null;
      }
      return ethers.computeAddress(pubHex);
    } catch (e) {
      console.warn('Failed to compute EVM address from public key:', e);
      return null;
    }
  }

  private fromBase64(b64: string): Uint8Array {
    if (typeof window !== 'undefined' && typeof atob === 'function') {
      const binStr = atob(b64);
      const arr = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) arr[i] = binStr.charCodeAt(i);
      return arr;
    }
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const nearChainSignatureService = new NearChainSignatureService();