"use client";

import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  clusterApiUrl,
  Commitment,
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export type SolanaWalletState = {
  connected: boolean;
  publicKey: string | null; // base58
};

type PhantomProvider = {
  isPhantom?: boolean;
  connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString?: () => string } | string }>;
  disconnect?: () => Promise<void>;
  signTransaction?: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  signAndSendTransaction?: (transaction: Transaction | VersionedTransaction) => Promise<{ signature: string }>;
};

const USDC_DECIMALS = 6n;
const DEFAULT_COMMITMENT: Commitment = 'confirmed';

class SolanaWalletService {
  private state: SolanaWalletState = { connected: false, publicKey: null };
  private solana: PhantomProvider | null = null;
  private connection: Connection | null = null;

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  private getRpcEndpoint(): string {
    return (
      process.env.NEXT_PUBLIC_SOLANA_RPC ||
      process.env.SOLANA_ALCHEMY_API_KEY && `https://solana-mainnet.g.alchemy.com/v2/${process.env.SOLANA_ALCHEMY_API_KEY}` ||
      clusterApiUrl('mainnet-beta')
    );
  }

  private ensureConnection(): Connection {
    if (!this.connection) {
      this.connection = new Connection(this.getRpcEndpoint(), DEFAULT_COMMITMENT);
    }
    return this.connection;
  }

  async init(): Promise<boolean> {
    if (!this.isBrowser()) return false;
    const provider = (window as unknown as { solana?: PhantomProvider }).solana;
    if (provider?.isPhantom) {
      this.solana = provider;
    }
    this.ensureConnection();
    return true;
  }

  async connectPhantom(): Promise<string | null> {
    if (!this.isBrowser()) return null;
    if (!this.solana) {
      await this.init();
      this.solana = (window as unknown as { solana?: PhantomProvider }).solana || null;
    }
    if (!this.solana?.isPhantom) {
      throw new Error('Phantom wallet not found');
    }
    if (!this.solana.connect) {
      throw new Error('Phantom wallet connect method not available');
    }
    const resp = await this.solana.connect({ onlyIfTrusted: false });
    let pk: string | null = null;
    if (resp?.publicKey) {
      if (typeof resp.publicKey === 'string') {
        pk = resp.publicKey;
      } else if (resp.publicKey.toString) {
        pk = resp.publicKey.toString();
      }
    }
    this.state = { connected: !!pk, publicKey: pk };
    return pk;
  }

  async disconnect(): Promise<void> {
    try { await this.solana?.disconnect?.(); } catch { /* ignore */ }
    this.state = { connected: false, publicKey: null };
  }

  isReady(): boolean {
    return !!this.state.connected && !!this.state.publicKey;
  }

  getPublicKey(): string | null {
    return this.state.publicKey;
  }

  /**
   * Get USDC token account balance on Solana (formatted string with 6 decimals)
   */
  async getUsdcBalance(rpcUrl: string, usdcMint: string): Promise<string> {
    if (!this.state.publicKey) return '0';

    const endpoint = rpcUrl || this.getRpcEndpoint();
    const connection = new Connection(endpoint, DEFAULT_COMMITMENT);
    const owner = new PublicKey(this.state.publicKey);
    const mint = new PublicKey(usdcMint);

    try {
      const associatedAddress = await getAssociatedTokenAddress(mint, owner, false);
      const balanceInfo = await connection.getTokenAccountBalance(associatedAddress);
      return balanceInfo?.value?.uiAmountString || '0';
    } catch (err) {
      // Fall back to aggregating all token accounts if ATA lookup fails
      try {
        const accounts = await connection.getTokenAccountsByOwner(owner, { mint });
        let total = 0n;
        for (const account of accounts.value) {
          const info = await connection.getTokenAccountBalance(account.pubkey);
          const raw = info?.value?.amount ? BigInt(info.value.amount) : 0n;
          total += raw;
        }
        if (total === 0n) return '0';
        const integer = total / (10n ** USDC_DECIMALS);
        const fractional = (total % (10n ** USDC_DECIMALS)).toString().padStart(Number(USDC_DECIMALS), '0');
        return `${integer}.${fractional}`;
      } catch (fallbackError) {
        console.warn('Failed to aggregate Solana USDC balance:', fallbackError);
        return '0';
      }
    }
  }

  /**
   * Sign a Solana transaction with Phantom wallet
   */
  async signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> {
    if (!this.state.connected || !this.state.publicKey || !this.solana) {
      throw new Error('Phantom wallet not connected - cannot sign transaction');
    }

    const provider = this.solana;
    if (typeof provider.signTransaction !== 'function') {
      throw new Error('Phantom wallet does not support signing transactions');
    }

    try {
      const result = await provider.signTransaction(transaction);
      return result;
    } catch (error) {
      throw new Error(`Failed to sign transaction with Phantom: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sign a message with Phantom wallet
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.state.connected || !this.state.publicKey || !this.solana) {
      throw new Error('Phantom wallet not connected - cannot sign message');
    }

    const provider = this.solana;
    if (typeof provider.signMessage !== 'function') {
      throw new Error('Phantom wallet does not support signing messages');
    }

    try {
      const result = await provider.signMessage(message);
      if (!result?.signature) {
        throw new Error('No signature returned from Phantom');
      }
      return result.signature;
    } catch (error) {
      throw new Error(`Failed to sign message with Phantom: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sign and send a transaction with Phantom
   */
  async signAndSendTransaction(transaction: Transaction | VersionedTransaction): Promise<string> {
    if (!this.state.connected || !this.state.publicKey || !this.solana) {
      throw new Error('Phantom wallet not connected - cannot sign transactions');
    }

    const provider = this.solana;
    if (typeof provider.signAndSendTransaction !== 'function') {
      throw new Error('Phantom wallet does not support signAndSendTransaction');
    }

    try {
      const result = await provider.signAndSendTransaction(transaction);
      if (!result?.signature) {
        throw new Error('No signature returned from Phantom');
      }
      return result.signature;
    } catch (error) {
      throw new Error(`Failed to sign and send transaction with Phantom: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const solanaWalletService = new SolanaWalletService();
