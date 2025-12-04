"use client";

// NEAR Wallet Selector Service
// Core Principles: ENHANCEMENT FIRST, DRY, CLEAN, MODULAR, PREVENT BLOAT
// - Initializes @near-wallet-selector/core once and exposes a tiny API
// - Keeps NEAR concerns separate from EVM WalletContext

import type { WalletSelector } from '@near-wallet-selector/core';
import { setupWalletSelector } from '@near-wallet-selector/core';
import type { WalletModuleFactory } from '@near-wallet-selector/core';
import { getConfig } from '@/config/nearConfig';

export type NearSelectorState = {
  ready: boolean;
  selector: WalletSelector | null;
  accountId: string | null;
};

class NearWalletSelectorService {
  private state: NearSelectorState = {
    ready: false,
    selector: null,
    accountId: null,
  };

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  async init(): Promise<boolean> {
    if (!this.isBrowser()) return false;
    if (this.state.ready && this.state.selector) return true;

    const cfg = getConfig();

    // Universal approach: Dynamically load available wallet modules
    // These are optional - gracefully handle if some aren't available
    const walletModules = await Promise.allSettled([
      import('@near-wallet-selector/my-near-wallet').then(m => m.setupMyNearWallet()),
      import('@near-wallet-selector/meteor-wallet').then(m => m.setupMeteorWallet()),
      import('@near-wallet-selector/here-wallet').then(m => m.setupHereWallet()),
      import('@near-wallet-selector/sender').then(m => m.setupSender()),
    ]);

    // Filter out failed imports and extract successful wallet modules
    const wallets = walletModules
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<WalletModuleFactory>).value);

    if (wallets.length === 0) {
      console.error('No NEAR wallet modules could be loaded');
      return false;
    }

    const selector = await setupWalletSelector({
      network: cfg.networkId as 'mainnet' | 'testnet',
      // Contract IDs can be provided for app-level sign-in if needed
      // Here we don't enforce a contractId to keep it generic for Chain Signatures flow
      modules: wallets,
    });

    this.state.selector = selector;
    this.state.accountId = await this.resolveActiveAccountId(selector);
    this.state.ready = true;
    return true;
  }

  private async resolveActiveAccountId(selector: WalletSelector): Promise<string | null> {
    try {
      const wallet = await selector.wallet();
      const accounts = await wallet.getAccounts();
      return accounts[0]?.accountId || null;
    } catch {
      return null;
    }
  }

  isReady(): boolean {
    return this.state.ready && !!this.state.selector;
  }

  getSelector(): WalletSelector | null {
    return this.state.selector;
  }

  getAccountId(): string | null {
    return this.state.accountId;
  }

  // Connect flow: prompts the user to sign in with any available wallet
  async connect(): Promise<string | null> {
    if (!this.isBrowser()) return null;
    if (!this.state.selector) {
      const ok = await this.init();
      if (!ok || !this.state.selector) return null;
    }

    try {
      // If a wallet is already available, prefer it
      const wallet = await this.state.selector!.wallet();
      const accounts = await wallet.getAccounts();
      if (accounts.length > 0) {
        this.state.accountId = accounts[0].accountId;
        return accounts[0].accountId;
      }

      // Otherwise, request sign in (no contractId to keep generic)
      // Some wallets require a contractId; for Chain Signatures usage, we keep this minimal
      await wallet.signIn({} as never);
      const refreshed = await wallet.getAccounts();
      this.state.accountId = refreshed[0]?.accountId || null;
      return this.state.accountId;
    } catch (e) {
      console.warn('NEAR connect failed:', e);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (!this.state.selector) return;
      const wallet = await this.state.selector.wallet();
      await wallet.signOut();
      this.state.accountId = null;
    } catch (e) {
      console.warn('NEAR disconnect failed:', e);
    }
  }
}

export const nearWalletSelectorService = new NearWalletSelectorService();
