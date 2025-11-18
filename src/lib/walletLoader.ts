/**
 * CONDITIONAL WALLET LOADER
 *
 * Dynamically loads wallet libraries only when needed
 * Prevents loading heavy Web3 libraries for users who don't need them
 */

interface WalletLibraries {
  metamask: any;
  walletconnect: any;
  phantom: any;
  solana: any;
  near: any;
}

class WalletLoader {
  private loadedLibraries = new Set<string>();
  private libraryPromises = new Map<string, Promise<any>>();

  /**
   * Load only the wallet library needed for the selected wallet type
   */
  async loadWalletLibrary(walletType: string): Promise<any> {
    if (this.loadedLibraries.has(walletType)) {
      return this.libraryPromises.get(walletType);
    }

    let libraryPromise: Promise<any>;

    switch (walletType) {
      case 'metamask':
      case 'walletconnect':
        // Load basic Web3 libraries
        libraryPromise = this.loadBasicWeb3();
        break;

      case 'phantom':
        // Load Solana libraries only when needed
        libraryPromise = this.loadSolanaWallet();
        break;

      case 'near':
        // Load NEAR libraries only when needed
        libraryPromise = this.loadNearWallet();
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
  private async loadBasicWeb3(): Promise<any> {
    const [ethersModule, rainbowModule] = await Promise.all([
      import('ethers'),
      import('@rainbow-me/rainbowkit'),
    ]);

    return {
      ethers: ethersModule,
      rainbowkit: rainbowModule,
    };
  }

  /**
   * Load Solana wallet libraries only when Phantom is selected
   */
  private async loadSolanaWallet(): Promise<any> {
    const [solanaWalletAdapter, solanaWeb3] = await Promise.all([
      import('@solana/wallet-adapter-react'),
      import('@solana/web3.js'),
    ]);

    return {
      walletAdapter: solanaWalletAdapter,
      web3: solanaWeb3,
    };
  }

  /**
   * Load NEAR wallet libraries only when NEAR is selected
   */
  private async loadNearWallet(): Promise<any> {
    const [nearApi, nearWalletSelector] = await Promise.all([
      import('@near-js/providers'),
      import('@near-wallet-selector/core'),
    ]);

    return {
      providers: nearApi,
      walletSelector: nearWalletSelector,
    };
  }

  /**
   * Preload commonly used wallet libraries
   */
  async preloadCommonWallets(): Promise<void> {
    // Only preload basic Web3 libraries that are most commonly used
    await this.loadWalletLibrary('metamask');
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
