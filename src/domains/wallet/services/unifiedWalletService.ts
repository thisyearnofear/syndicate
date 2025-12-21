/**
 * UNIFIED WALLET SERVICE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing wallet connection logic
 * - DRY: Single source of truth for all wallet interactions
 * - CLEAN: Clear separation of wallet provider logic
 * - MODULAR: Composable wallet service
 */

import { useCallback } from 'react';
import { request } from '@stacks/connect';
import { createError } from '@/shared/utils';
import { useWalletContext } from '@/context/WalletContext';
import type { WalletModuleFactory } from '@near-wallet-selector/core';
import { WalletType, WalletTypes, STACKS_WALLETS, type StacksWalletType } from '../types';

// =============================================================================
// WALLET DETECTION
// =============================================================================

/**
 * CLEAN: Detect available wallets
 * Note: MetaMask/WalletConnect is handled by wagmi/RainbowKit to avoid conflicts
 */
export function getAvailableWallets(): WalletType[] {
  const available: WalletType[] = [];

  // EVM wallets (MetaMask, WalletConnect) handled by wagmi/RainbowKit

  // Check for Phantom (Solana)
  if (typeof window !== 'undefined' && window.solana?.isPhantom) {
    available.push(WalletTypes.SOLANA);
  }

  // Check for any Stacks wallet (Leather, Xverse, Asigna, Fordefi)
  // @stacks/connect auto-detects which one is available
  if (typeof window !== 'undefined') {
    const hasStacksWallet =
      (window as any).LeatherProvider ||
      (window as any).XverseProviders ||
      (window as any).AsignaProvider ||
      (window as any).FordefiProvider;

    if (hasStacksWallet) {
      available.push(WalletTypes.STACKS);
    }
  }

  // Social login is always available
  available.push(WalletTypes.SOCIAL);

  // NEAR is always available
  available.push(WalletTypes.NEAR);

  return available;
}

/**
 * CLEAN: Get wallet status
 */
export function getWalletStatus(walletType: WalletType): {
  isAvailable: boolean;
  isInstalled: boolean;
  downloadUrl?: string;
} {
  switch (walletType) {
    case WalletTypes.EVM:
      return {
        isAvailable: typeof window !== 'undefined' && !!window.ethereum,
        isInstalled: typeof window !== 'undefined' && !!window.ethereum,
        downloadUrl: 'https://metamask.io/download/',
      };

    case WalletTypes.SOLANA:
      return {
        isAvailable: typeof window !== 'undefined' && !!window.solana?.isPhantom,
        isInstalled: typeof window !== 'undefined' && !!window.solana?.isPhantom,
        downloadUrl: 'https://phantom.app/',
      };

    case WalletTypes.STACKS:
      // Check if any Stacks wallet is available
      const hasStacksWallet = typeof window !== 'undefined' && (
        !!(window as any).LeatherProvider ||
        !!(window as any).XverseProviders ||
        !!(window as any).AsignaProvider ||
        !!(window as any).FordefiProvider
      );
      return {
        isAvailable: hasStacksWallet,
        isInstalled: hasStacksWallet,
        downloadUrl: 'https://leather.io/install',
      };

    case WalletTypes.SOCIAL:
    case WalletTypes.NEAR:
      return {
        isAvailable: true,
        isInstalled: true,
      };

    default:
      return {
        isAvailable: false,
        isInstalled: false,
      };
  }
}

// =============================================================================
// BROWSER COMPATIBILITY UTILS
// =============================================================================

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

// =============================================================================
// WALLET SERVICE HOOK
// =============================================================================

/**
 * ENHANCEMENT FIRST: Enhanced unified wallet hook
 */
export function useUnifiedWallet(): {
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  clearError: () => void;
} {
  const { state, dispatch } = useWalletContext();

  /**
   * PERFORMANT: Connect to wallet with error handling
   */
  const connect = useCallback(async (walletType: WalletType) => {
    // Check if we're in a browser environment
    if (!isBrowser()) {
      const error = createError('ENV_ERROR', 'Wallet connection is only available in browser environments');
      dispatch({ type: 'CONNECT_FAILURE', payload: { error: error.message } });
      throw error;
    }

    dispatch({ type: 'CONNECT_START', payload: { walletType } });

    try {
      // CLEANUP: If user is switching wallets, disconnect the old one first
      if (state.isConnected && state.walletType && state.walletType !== walletType) {
        console.log(`Switching from ${state.walletType} to ${walletType}, disconnecting old wallet...`);
        dispatch({ type: 'DISCONNECT' });

        // Give a brief moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const walletStatus = getWalletStatus(walletType);

      if (!walletStatus.isAvailable) {
        throw createError(
          'WALLET_NOT_AVAILABLE',
          `${walletType} wallet is not available. Please install it first.`,
          { downloadUrl: walletStatus.downloadUrl }
        );
      }

      // Initialize variables - EVM case throws error so won't get here
      let address: string = '';
      let chainId: number = 0;

      switch (walletType) {
        case WalletTypes.EVM:
          // For EVM wallets, prefer wagmi/RainbowKit connection to avoid conflicts
          // wagmi will handle the connection and our WalletContext will sync with it
          // We don't need to do anything here as RainbowKit handles the connection flow
          console.log('EVM wallet connection handled by RainbowKit');
          return;
          break;

        case WalletTypes.SOLANA:
          // SOLANA-FIRST APPROACH: Always connect via Solana interface first
          // This ensures we get Phantom specifically (not MetaMask via window.ethereum)
          const hasPhantomSolana = window.solana?.isPhantom;

          if (!hasPhantomSolana) {
            throw createError('WALLET_NOT_FOUND', 'Phantom wallet is not installed. Please install it from phantom.app');
          }

          // METAMASK CONFLICT PREVENTION: Disable MetaMask auto-connection while using Phantom
          // This prevents wagmi from interfering with Solana wallet connections
          try {
            if (window.ethereum) {
              const originalProvider = window.ethereum as unknown;
              (window as unknown as { ethereum?: unknown }).ethereum = null;
              setTimeout(() => {
                (window as unknown as { ethereum?: unknown }).ethereum = originalProvider;
              }, 1000);
            }
          } catch (error) {
            console.warn('Could not disable MetaMask auto-connect:', error);
            // Continue anyway - not critical
          }

          try {
            // Always connect via Solana interface first to guarantee Phantom connection
            const solanaWallet = window.solana as { isPhantom?: boolean; publicKey?: { toString(): string }; connect(): Promise<{ publicKey: { toString(): string } }> } | undefined;
            let connection;

            // Check if already connected
            if (solanaWallet?.publicKey) {
              connection = { publicKey: solanaWallet.publicKey.toString() };
            } else {
              // Connect to Phantom via Solana (avoids MetaMask conflicts)
              connection = await solanaWallet?.connect();
            }

            if (!connection?.publicKey) {
              throw createError('CONNECTION_REJECTED', 'Failed to connect to Phantom. Please approve the connection.');
            }

            // Store Solana address
            address = connection.publicKey.toString();
            chainId = 0; // Use 0 for Solana (non-EVM)

            // Initialize Solana wallet service for cross-chain operations
            try {
              const { solanaWalletService } = await import('@/services/solanaWalletService');
              await solanaWalletService.init();

              // Update service state to reflect connection
              if (!solanaWalletService.isReady()) {
                await solanaWalletService.connectPhantom();
              }
            } catch (solanaServiceError) {
              console.warn('Solana wallet service initialization failed:', solanaServiceError);
              // Continue without service for basic wallet functionality
            }

            // Note: For lottery purchases, users will use the cross-chain bridge
            // via useCrossChainPurchase hook to bridge Solana USDC -> Base -> Purchase
            console.log('Phantom connected via Solana. Cross-chain purchases available via CCTP bridge.');

          } catch (error: unknown) {
            const code = (error as { code?: number }).code;
            const message = (error as { message?: string }).message || '';
            if (code === 4001 || message.includes('User rejected')) {
              throw createError('CONNECTION_REJECTED', 'Connection rejected by user');
            }
            throw createError('CONNECTION_FAILED', `Failed to connect to Phantom: ${message}`);
          }
          break;

        case WalletTypes.SOCIAL:
          try {
            // For now, show coming soon message for social login
            throw createError('WALLET_NOT_SUPPORTED', 'Social login is coming soon. Please use MetaMask for now.');
          } catch (error: unknown) {
            console.error('Social login error:', error);
            throw error as Error;
          }
          break;

        case WalletTypes.NEAR:
          try {
            // Use the centralized NEAR wallet service which handles modal display
            const { nearWalletSelectorService } = await import('@/domains/wallet/services/nearWalletSelectorService');
            const accountId = await nearWalletSelectorService.connect();

            if (!accountId) {
              throw createError('CONNECTION_REJECTED', 'NEAR wallet connection was cancelled or timed out');
            }

            address = accountId; // Store NEAR accountId in address field
            chainId = 0; // Sentinel for NEAR (non-EVM)

            console.log('NEAR wallet connected:', accountId);
          } catch (error: unknown) {
            const message = (error as { message?: string }).message || '';
            console.error('NEAR connection error:', error);

            // Provide more specific error message
            if (message.includes('timeout') || message.includes('timed out')) {
              throw createError('CONNECTION_TIMEOUT', 'NEAR wallet connection timed out. Please try again.');
            }

            if (message.includes('cancelled') || message.includes('rejected')) {
              throw createError('CONNECTION_REJECTED', 'NEAR wallet connection was cancelled.');
            }

            throw createError('CONNECTION_FAILED', `Failed to connect NEAR wallet: ${message || 'Unknown error'}`);
          }
          break;

        case WalletTypes.STACKS:
          try {
            // METAMASK CONFLICT PREVENTION: Disable MetaMask auto-connection while using Stacks
            // This prevents wagmi from interfering with Stacks wallet connections (like Leather)
            try {
              if (typeof window !== 'undefined' && (window as any).ethereum) {
                const originalProvider = (window as any).ethereum;
                (window as any).ethereum = null;
                setTimeout(() => {
                  (window as any).ethereum = originalProvider;
                }, 1000);
              }
            } catch (error) {
              console.warn('Could not disable MetaMask auto-connect for Stacks:', error);
            }

            const stacksWallet = await connectStacksWallet(WalletTypes.STACKS as StacksWalletType);
            address = stacksWallet.address;
            chainId = 12345; // Stacks mainnet chain ID

            console.log('Stacks wallet connected:', address);
          } catch (error: unknown) {
            const message = (error as { message?: string }).message || '';
            console.error('Stacks wallet connection error:', error);

            if (message.includes('timeout') || message.includes('timed out')) {
              throw createError('CONNECTION_TIMEOUT', 'Stacks wallet connection timed out. Please try again.');
            }

            if (message.includes('cancelled') || message.includes('rejected')) {
              throw createError('CONNECTION_REJECTED', 'Stacks wallet connection was cancelled.');
            }

            throw createError('CONNECTION_FAILED', `Failed to connect Stacks wallet: ${message || 'Unknown error'}`);
          }
          break;

        default:
          throw createError('UNSUPPORTED_WALLET', `Wallet type ${walletType} is not supported`);
      }

      dispatch({
        type: 'CONNECT_SUCCESS',
        payload: { address, walletType, chainId }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      dispatch({ type: 'CONNECT_FAILURE', payload: { error: errorMessage } });
      throw error;
    }
  }, [dispatch, state.isConnected, state.walletType]);

  /**
   * CLEAN: Disconnect wallet
   */
  const disconnect = useCallback(async () => {
    // No direct wagmi hook calls in callbacks; rely on context state
    // Then update internal state
    dispatch({ type: 'DISCONNECT' });
  }, [dispatch]);

  /**
   * ENHANCEMENT FIRST: Switch chain with error handling
   */
  const switchChain = useCallback(async (targetChainId: number) => {
    if (!state.isConnected || !state.walletType) {
      throw createError('WALLET_NOT_CONNECTED', 'No wallet connected');
    }

    // Check if we're in a browser environment
    if (!isBrowser()) {
      throw createError('ENV_ERROR', 'Chain switching is only available in browser environments');
    }

    try {
      if (state.walletType === WalletTypes.EVM && window.ethereum) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });

        dispatch({ type: 'NETWORK_CHANGED', payload: { chainId: targetChainId } });
      } else if (state.walletType === WalletTypes.SOLANA) {
        // Solana wallet connected via Phantom - chain switching happens through cross-chain bridge
        throw createError('UNSUPPORTED_OPERATION', 'Solana wallet is connected via Phantom. Use cross-chain bridge for EVM operations.');
      } else {
        throw createError('UNSUPPORTED_OPERATION', 'Chain switching not supported for this wallet');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch chain';
      dispatch({ type: 'CONNECT_FAILURE', payload: { error: errorMessage } });
      throw error;
    }
  }, [state, dispatch]);

  /**
   * CLEAN: Clear error state
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, [dispatch]);

  return {
    connect,
    disconnect,
    switchChain,
    clearError,
  };
}

// =============================================================================
// STACKS WALLET CONNECTION HELPERS
// =============================================================================

/**
 * Connect to a Stacks wallet
 * 
 * Uses @stacks/connect for all Stacks wallets, which provides:
 * - Automatic wallet detection
 * - JSON RPC 2.0 protocol handling
 * - Compatibility layer for different wallet providers
 * 
 * Note: The walletType parameter is kept for backward compatibility but @stacks/connect
 * will automatically detect the available wallet and show a selection UI if multiple are present.
 */
async function connectStacksWallet(walletType: StacksWalletType): Promise<{ address: string; publicKey: string }> {
  // All Stacks wallets use the same @stacks/connect interface now
  // The walletType parameter is for logging/tracking purposes only
  console.log(`Connecting with Stacks wallet type: ${walletType}`);
  return connectStacksWalletWithConnect();
}

/**
 * Connect to any Stacks wallet using @stacks/connect
 * 
 * Uses @stacks/connect to auto-detect and communicate with available Stacks wallets.
 * Handles Leather, Xverse, Asigna, Fordefi, etc. automatically.
 * 
 * NOTE: Some Stacks wallet extensions (particularly Leather) have a known bug where
 * they may fail to serialize the response properly, causing "setImmedia... is not valid JSON" errors.
 * We wrap the call to ensure clean serialization of the result.
 */
async function connectStacksWalletWithConnect(): Promise<{ address: string; publicKey: string }> {
  try {
    console.log('Initiating Stacks wallet connection with @stacks/connect...');

    // Check if any Stacks wallet provider is available
    const hasStacksWallet = typeof window !== 'undefined' && (
      !!(window as any).LeatherProvider ||
      !!(window as any).XverseProviders ||
      !!(window as any).AsignaProvider ||
      !!(window as any).FordefiProvider
    );

    if (!hasStacksWallet) {
      throw createError(
        'WALLET_NOT_INSTALLED',
        'No Stacks wallet detected. Please install Leather, Xverse, or another Stacks-compatible wallet.',
        { downloadUrl: 'https://leather.io/install' }
      );
    }

    // @stacks/connect.request() uses pattern: request(method, params)
    // For stx_getAddresses, no params are needed
    // Wrap the call to ensure proper JSON serialization
    const response = await (async () => {
      try {
        const res = await request('stx_getAddresses');
        // Force re-serialization to clean any non-serializable properties
        return JSON.parse(JSON.stringify(res));
      } catch (e) {
        // If serialization fails, try to extract just the data we need
        const res = await request('stx_getAddresses');
        if (res?.addresses && Array.isArray(res.addresses)) {
          return { addresses: res.addresses };
        }
        throw e;
      }
    })();

    console.log('Stacks wallet connection successful');

    // Response format from @stacks/connect:
    // { addresses: [{ address: string, publicKey: string, ... }, ...] }
    if (!response?.addresses || !Array.isArray(response.addresses) || response.addresses.length === 0) {
      throw new Error('No Stacks addresses found in wallet response');
    }

    // Get the first address (primary account)
    const primaryAddress = response.addresses[0];

    if (!primaryAddress?.address) {
      throw createError(
        'NO_STACKS_ADDRESS',
        'No Stacks address found. Please make sure you have a Stacks account in your wallet.'
      );
    }

    // Return only serializable data (no function references, no circular references)
    return {
      address: String(primaryAddress.address),
      publicKey: primaryAddress.publicKey ? String(primaryAddress.publicKey) : '',
    };
  } catch (error) {
    console.error('Stacks wallet connection error:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for user rejection
    if (errorMessage?.includes('rejected') || errorMessage?.includes('cancelled')) {
      throw createError('CONNECTION_REJECTED', 'Connection was rejected. Please try again.');
    }

    // Check if no wallet is detected
    if (errorMessage?.includes('No matching provider') || errorMessage?.includes('not installed')) {
      throw createError(
        'WALLET_NOT_INSTALLED',
        'No Stacks wallet detected. Please install Leather, Xverse, or another Stacks-compatible wallet.',
        { downloadUrl: 'https://leather.io/install' }
      );
    }

    // Check for signMultipleTransactions error (wallet provider not properly initialized)
    if (errorMessage?.includes('signMultipleTransactions') || errorMessage?.includes('undefined')) {
      throw createError(
        'WALLET_INITIALIZATION_FAILED',
        'Stacks wallet provider is not properly initialized. Please refresh the page and try again.',
        { troubleshooting: 'Make sure your wallet extension is running and unlocked.' }
      );
    }

    throw createError('CONNECTION_FAILED', `Failed to connect Stacks wallet: ${errorMessage}`);
  }
}
