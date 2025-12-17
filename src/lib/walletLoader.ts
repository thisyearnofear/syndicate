/**
 * CONDITIONAL WALLET LOADER
 *
 * Dynamically loads wallet libraries only when needed
 * Prevents loading heavy Web3 libraries for users who don't need them
 */

import type { WalletType } from '@/domains/wallet/types';

interface WalletLibraries {
  evm: unknown;
  solana: unknown;
  stacks: unknown;
  near: unknown;
  social: unknown;
}

class WalletLoader {
  private loadedLibraries = new Set<string>();
  private libraryPromises = new Map<string, Promise<unknown>>();

  /**
   * Load only the wallet library needed for the selected wallet type
   */
  async loadWalletLibrary(walletType: string | WalletType): Promise<unknown> {
    if (this.loadedLibraries.has(walletType)) {
      return this.libraryPromises.get(walletType);
    }

    let libraryPromise: Promise<unknown>;

    switch (walletType) {
      case 'evm':
        // Load basic Web3 libraries for EVM chains
        libraryPromise = this.loadBasicWeb3();
        break;

      case 'solana':
        // Load Solana libraries only when needed
        libraryPromise = this.loadSolanaWallet();
        break;

      case 'near':
        // Load NEAR libraries only when needed
        libraryPromise = this.loadNearWallet();
        break;

      case 'stacks':
        // Stacks wallets use injected providers (window.LeatherProvider, etc.)
        // No heavy external libraries to load
        libraryPromise = Promise.resolve({});
        break;

      case 'social':
        // Social login - load when needed
        libraryPromise = Promise.resolve({});
        break;

      default:
        // For unknown wallet types, don't throw an error but return a resolved promise
        console.warn(`Unknown wallet type: ${walletType}, skipping library load`);
        return Promise.resolve({});
    }

    this.libraryPromises.set(walletType, libraryPromise);
    this.loadedLibraries.add(walletType);

    return libraryPromise.catch((error) => {
      // Remove from loaded libraries if loading failed
      this.loadedLibraries.delete(walletType);
      this.libraryPromises.delete(walletType);
      throw error;
    });
  }

  /**
   * Load basic Ethereum/Web3 libraries
   */
  private async loadBasicWeb3(): Promise<{ ethers: typeof import('ethers'); rainbowkit: unknown }> {
    const [ethersModule, rainbowModule] = await Promise.all([
      import('ethers'),
      import('@rainbow-me/rainbowkit'),
    ]);

    return { ethers: ethersModule, rainbowkit: rainbowModule };
  }

  /**
   * Load Solana wallet libraries only when Phantom is selected
   */
  private async loadSolanaWallet(): Promise<{
    web3: typeof import('@solana/web3.js');
    walletAdapterBase: typeof import('@solana/wallet-adapter-base');
    walletAdapterReact: typeof import('@solana/wallet-adapter-react');
    walletAdapterWallets: typeof import('@solana/wallet-adapter-wallets');
    walletAdapterUi: typeof import('@solana/wallet-adapter-react-ui');
  }> {
    try {
      const [web3, walletAdapterBase, walletAdapterReact, walletAdapterWallets, walletAdapterUi] = await Promise.all([
        import('@solana/web3.js'),
        import('@solana/wallet-adapter-base'),
        import('@solana/wallet-adapter-react'),
        import('@solana/wallet-adapter-wallets'),
        import('@solana/wallet-adapter-react-ui'),
      ]);

      return {
        web3,
        walletAdapterBase,
        walletAdapterReact,
        walletAdapterWallets,
        walletAdapterUi,
      };
    } catch (error) {
      console.error('[WalletLoader] Failed to load Solana libraries', error);
      throw error;
    }
  }

  /**
   * Load NEAR wallet libraries only when NEAR is selected
   */
  private async loadNearWallet(): Promise<{ providers: unknown; walletSelector: unknown }> {
    const [nearApi, nearWalletSelector] = await Promise.all([
      import('@near-js/providers'),
      import('@near-wallet-selector/core'),
    ]);

    return { providers: nearApi, walletSelector: nearWalletSelector };
  }

  /**
   * Preload commonly used wallet libraries
   */
  async preloadCommonWallets(): Promise<void> {
    // Only preload basic Web3 libraries that are most commonly used
    await this.loadWalletLibrary('evm');
  }

  /**
   * Check if a wallet library is already loaded
   */
  isLoaded(walletType: string): boolean {
    return this.loadedLibraries.has(walletType);
  }

  /**
   * Get loading progress for UX feedback
   */
  getLoadingProgress(): { loaded: string[], loading: string[] } {
    return {
      loaded: Array.from(this.loadedLibraries),
      loading: Array.from(this.libraryPromises.keys()).filter(key => !this.loadedLibraries.has(key)),
    };
  }
}

// Singleton instance
export const walletLoader = new WalletLoader();

// Export types
export type { WalletLibraries };
