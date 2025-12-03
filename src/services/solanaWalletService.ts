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

    const accounts = await connection.getTokenAccountsByOwner(owner, { mint });
    let total = 0n;
    for (const account of accounts.value) {
      // Account layout parsing is heavy; call getTokenAccountBalance for each (RPC helps parse)
      const info = await connection.getTokenAccountBalance(account.pubkey);
      const ui = info?.value?.amount || '0';
      total += BigInt(ui);
    }
    // USDC has 6 decimals
    const integer = total / 1000000n;
    const frac = (total % 1000000n).toString().padStart(6, '0');
    return `${integer}.${frac}`;
  }
}

export const solanaWalletService = new SolanaWalletService();