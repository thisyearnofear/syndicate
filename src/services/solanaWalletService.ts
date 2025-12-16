"use client";

/**
 * Solana Wallet Service (Phantom)
 * 
 * STATUS: DISABLED for hackathon (Solana dependencies removed)
 * 
 * TO RE-ENABLE:
 * 1. Add Solana deps back to package.json
 * 2. Replace stub imports with real '@solana/*' packages
 * 3. Restore dynamic imports below
 */

// STUB: Using stubs while Solana deps are disabled
import * as SolanaStubs from '@/stubs/solana';

export type SolanaWalletState = {
  connected: boolean;
  publicKey: string | null; // base58
};

type PhantomProvider = {
  isPhantom?: boolean;
  connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString?: () => string } | string }>;
  disconnect?: () => Promise<void>;
  signTransaction?: (transaction: unknown) => Promise<{ signature?: Uint8Array | string }>;
  signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  signAndSendTransaction?: (transaction: unknown) => Promise<{ signature: string }>;
};

class SolanaWalletService {
  private state: SolanaWalletState = { connected: false, publicKey: null };
  private solana: PhantomProvider | null = null;
  private web3: typeof SolanaStubs | null = null;

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  async init(): Promise<boolean> {
    if (!this.isBrowser()) return false;
    const w = window as unknown as { solana?: PhantomProvider };
    if (w.solana && w.solana.isPhantom) {
      this.solana = w.solana;
    }
    // STUB: Use stubs instead of real Solana libs (disabled for hackathon)
    this.web3 = SolanaStubs;
    console.warn('[SolanaWalletService] Using stubs - Solana is disabled for hackathon');
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
    try { await this.solana?.disconnect?.(); } catch { }
    this.state = { connected: false, publicKey: null };
  }

  isReady(): boolean {
    return !!this.state.connected && !!this.state.publicKey;
  }

  getPublicKey(): string | null {
    return this.state.publicKey;
  }

  // Get USDC token account balance on Solana (in 6-decimal string)
  async getUsdcBalance(rpcUrl: string, usdcMint: string): Promise<string> {
    if (!this.state.publicKey) return '0';
    if (!this.web3) await this.init();
    if (!this.web3) {
      throw new Error('Failed to initialize Solana web3 library');
    }
    const { Connection, PublicKey } = this.web3;
    const connection = new Connection(rpcUrl, 'confirmed');

    // Query token accounts by owner + mint and sum balances
    const owner = new PublicKey(this.state.publicKey);
    const mint = new PublicKey(usdcMint);

    const accounts = await (connection as any).getTokenAccountsByOwner(owner, { mint });
    let total = 0n;
    for (const account of accounts.value) {
      // Account layout parsing is heavy; call getTokenAccountBalance for each (RPC helps parse)
      const info = await connection.getTokenAccountBalance(account.pubkey);
      const ui = info?.value?.uiAmount || 0;
      total += BigInt(Math.floor(ui * 1000000)); // Convert to smallest unit (6 decimals)
    }
    // USDC has 6 decimals
    const integer = total / 1000000n;
    const frac = (total % 1000000n).toString().padStart(6, '0');
    return `${integer}.${frac}`;
    }

    /**
    * Sign a Solana transaction with Phantom wallet
    * 
    * PHASE 4 PRODUCTION: Used by Base-Solana Bridge for Phantom signatures
    * Requires wallet to be connected first via connectPhantom()
    * 
    * @param transaction - Transaction object from @solana/web3.js
    * @returns Signature string or Uint8Array
    * @throws Error if wallet not connected or signing fails
    */
    async signTransaction(transaction: unknown): Promise<string | Uint8Array> {
    if (!this.state.connected || !this.state.publicKey) {
      throw new Error('Phantom wallet not connected');
    }

    if (!this.solana?.signTransaction) {
      throw new Error('Phantom wallet does not support signing transactions');
    }

    try {
      const result = await this.solana.signTransaction(transaction);
      if (!result?.signature) {
        throw new Error('No signature returned from Phantom');
      }
      return result.signature;
    } catch (error) {
      throw new Error(`Failed to sign transaction with Phantom: ${error instanceof Error ? error.message : String(error)}`);
    }
    }

    /**
    * Sign a message with Phantom wallet
    * 
    * Useful for authentication or message verification
    * 
    * @param message - Message bytes to sign
    * @returns Signature as Uint8Array
    * @throws Error if wallet not connected or signing fails
    */
    async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.state.connected || !this.state.publicKey) {
      throw new Error('Phantom wallet not connected');
    }

    if (!this.solana?.signMessage) {
      throw new Error('Phantom wallet does not support signing messages');
    }

    try {
      const result = await this.solana.signMessage(message);
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
    * 
    * PHASE 4 PRODUCTION: For Base-Solana Bridge USDC locking
    * Phantom handles signing and broadcasting to Solana network
    * 
    * @param transaction - Transaction object from @solana/web3.js
    * @returns Transaction signature string
    * @throws Error if wallet not connected or transaction fails
    */
    async signAndSendTransaction(transaction: unknown): Promise<string> {
    if (!this.state.connected || !this.state.publicKey) {
      throw new Error('Phantom wallet not connected');
    }

    if (!this.solana?.signAndSendTransaction) {
      throw new Error('Phantom wallet does not support signAndSendTransaction');
    }

    try {
      const result = await this.solana.signAndSendTransaction(transaction);
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