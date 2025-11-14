"use client";

/**
 * Solana Wallet Service (Phantom)
 * - Minimal, modular service to connect Phantom and read balances (USDC)
 * - Lazy loads @solana/web3.js and @solana/spl-token to prevent bloat
 */

import { walletLoader } from '@/lib/walletLoader';

export type SolanaWalletState = {
  connected: boolean;
  publicKey: string | null; // base58
};

class SolanaWalletService {
  private state: SolanaWalletState = { connected: false, publicKey: null };
  private solana: any | null = null; // window.solana
  private web3: any | null = null; // @solana/web3.js
  private splToken: any | null = null; // @solana/spl-token

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  async init(): Promise<boolean> {
    if (!this.isBrowser()) return false;
    if ((window as any).solana && (window as any).solana.isPhantom) {
      this.solana = (window as any).solana;
    }
    // Lazy import libs only when needed
    const libs = await walletLoader.loadWalletLibrary('phantom');
    this.web3 = libs?.web3;
    try {
      this.splToken = (await import('@solana/spl-token'));
    } catch (_) {
      // optional until used
    }
    return true;
  }

  async connectPhantom(): Promise<string | null> {
    if (!this.isBrowser()) return null;
    if (!this.solana) {
      await this.init();
      this.solana = (window as any).solana;
    }
    if (!this.solana?.isPhantom) {
      throw new Error('Phantom wallet not found');
    }
    const resp = await this.solana.connect({ onlyIfTrusted: false });
    const pk = resp?.publicKey?.toString?.() || resp?.publicKey || null;
    this.state = { connected: !!pk, publicKey: pk };
    return pk;
  }

  async disconnect(): Promise<void> {
    try { await this.solana?.disconnect?.(); } catch(_) {}
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
    const { Connection, PublicKey } = this.web3;
    const connection = new Connection(rpcUrl, 'confirmed');

    // Query token accounts by owner + mint and sum balances
    const owner = new PublicKey(this.state.publicKey);
    const mint = new PublicKey(usdcMint);

    // spl-token not required for balance summation; use token program filter
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const accounts = await connection.getTokenAccountsByOwner(owner, { mint });
    let total = 0n;
    for (const { account } of accounts.value) {
      const data = account.data;
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
