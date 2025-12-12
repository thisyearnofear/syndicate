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
import { createError } from '@/shared/utils';
import { useWalletContext } from '@/context/WalletContext';
import type { WalletModuleFactory } from '@near-wallet-selector/core';
import { WalletType, WalletTypes, STACKS_WALLETS, type StacksWalletType } from '../types';

// =============================================================================
// WALLET DETECTION
// =============================================================================

/**
 * CLEAN: Detect available wallets
 * Note: MetaMask is handled by wagmi/RainbowKit to avoid conflicts
 */
export function getAvailableWallets(): WalletType[] {
  const available: WalletType[] = [];

  // MetaMask is handled by wagmi/RainbowKit - skip here to avoid conflicts
  // Check for Phantom
  if (typeof window !== 'undefined' && window.solana?.isPhantom) {
    available.push(WalletTypes.PHANTOM);
  }

  // Check for Stacks wallets
  if (typeof window !== 'undefined') {
    if (window.LeatherProvider) {
      available.push(WalletTypes.LEATHER);
    }
    if (window.XverseProviders?.StacksProvider) {
      available.push(WalletTypes.XVERSE);
    }
    if (window.AsignaProvider) {
      available.push(WalletTypes.ASIGNA);
    }
    if (window.FordefiProvider) {
      available.push(WalletTypes.FORDEFI);
    }
  }

  // WalletConnect is handled separately by WalletConnectManager component

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
    case WalletTypes.METAMASK:
      return {
        isAvailable: typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
        isInstalled: typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
        downloadUrl: 'https://metamask.io/download/',
      };

    case WalletTypes.PHANTOM:
      return {
        isAvailable: typeof window !== 'undefined' && !!window.solana?.isPhantom,
        isInstalled: typeof window !== 'undefined' && !!window.solana?.isPhantom,
        downloadUrl: 'https://phantom.app/',
      };

    case WalletTypes.SOCIAL:
    case WalletTypes.NEAR:
      return {
        isAvailable: true,
        isInstalled: true,
      };

    // Stacks ecosystem wallets
    case WalletTypes.LEATHER:
      return {
        isAvailable: typeof window !== 'undefined' && !!window.LeatherProvider,
        isInstalled: typeof window !== 'undefined' && !!window.LeatherProvider,
        downloadUrl: 'https://leather.io/',
      };

    case WalletTypes.XVERSE:
      return {
        isAvailable: typeof window !== 'undefined' && !!window.XverseProviders,
        isInstalled: typeof window !== 'undefined' && !!window.XverseProviders,
        downloadUrl: 'https://xverse.app/',
      };

    case WalletTypes.ASIGNA:
      return {
        isAvailable: typeof window !== 'undefined' && !!window.AsignaProvider,
        isInstalled: typeof window !== 'undefined' && !!window.AsignaProvider,
        downloadUrl: 'https://asigna.io/',
      };

    case WalletTypes.FORDEFI:
      return {
        isAvailable: typeof window !== 'undefined' && !!window.FordefiProvider,
        isInstalled: typeof window !== 'undefined' && !!window.FordefiProvider,
        downloadUrl: 'https://www.fordefi.com/',
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

      // Initialize variables - MetaMask case throws error so won't get here
      let address: string = '';
      let chainId: number = 0;

      switch (walletType) {
        case WalletTypes.METAMASK:
          // For MetaMask, prefer wagmi/RainbowKit connection to avoid conflicts
          // wagmi will handle the connection and our WalletContext will sync with it
          // We don't need to do anything here as RainbowKit handles the connection flow
          console.log('MetaMask connection handled by RainbowKit');
          return;
          break;

        case WalletTypes.PHANTOM:
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

        // Stacks ecosystem wallets
        case WalletTypes.LEATHER:
        case WalletTypes.XVERSE:
        case WalletTypes.ASIGNA:
        case WalletTypes.FORDEFI:
          try {
            const stacksWallet = await connectStacksWallet(walletType as StacksWalletType);
            address = stacksWallet.address;
            chainId = 12345; // Stacks mainnet chain ID

            console.log(`${walletType} wallet connected:`, address);
          } catch (error: unknown) {
            const message = (error as { message?: string }).message || '';
            console.error(`${walletType} connection error:`, error);

            if (message.includes('timeout') || message.includes('timed out')) {
              throw createError('CONNECTION_TIMEOUT', `${walletType} wallet connection timed out. Please try again.`);
            }

            if (message.includes('cancelled') || message.includes('rejected')) {
              throw createError('CONNECTION_REJECTED', `${walletType} wallet connection was cancelled.`);
            }

            throw createError('CONNECTION_FAILED', `Failed to connect ${walletType} wallet: ${message || 'Unknown error'}`);
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
      if (state.walletType === WalletTypes.METAMASK && window.ethereum) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });

        dispatch({ type: 'NETWORK_CHANGED', payload: { chainId: targetChainId } });
      } else if (state.walletType === WalletTypes.PHANTOM) {
        // Phantom connected via Solana - chain switching happens through cross-chain bridge
        throw createError('UNSUPPORTED_OPERATION', 'Phantom is connected via Solana. Use cross-chain bridge for EVM operations.');
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
 */
async function connectStacksWallet(walletType: StacksWalletType): Promise<{ address: string; publicKey: string }> {
  switch (walletType) {
    case WalletTypes.LEATHER:
      return connectLeatherWallet();

    case WalletTypes.XVERSE:
      return connectXverseWallet();

    case WalletTypes.ASIGNA:
      return connectAsignaWallet();

    case WalletTypes.FORDEFI:
      return connectFordefiWallet();

    default:
      throw new Error(`Unsupported Stacks wallet: ${walletType}`);
  }
}

/**
 * Connect to Leather wallet
 */
async function connectLeatherWallet(): Promise<{ address: string; publicKey: string }> {
  const provider = window.LeatherProvider;
  if (!provider) {
    throw new Error('Leather wallet is not installed. Please install it from leather.io');
  }

  try {
    const result = await provider.connect();
    return {
      address: result.address,
      publicKey: result.publicKey,
    };
  } catch (error) {
    throw new Error(`Failed to connect to Leather wallet: ${error}`);
  }
}

/**
 * Connect to Xverse wallet
 */
async function connectXverseWallet(): Promise<{ address: string; publicKey: string }> {
  const provider = window.XverseProviders?.StacksProvider;
  if (!provider) {
    throw new Error('Xverse wallet is not installed. Please install it from xverse.app');
  }

  try {
    const result = await provider.connect();
    return {
      address: result.address,
      publicKey: result.publicKey,
    };
  } catch (error) {
    throw new Error(`Failed to connect to Xverse wallet: ${error}`);
  }
}

/**
 * Connect to Asigna wallet
 */
async function connectAsignaWallet(): Promise<{ address: string; publicKey: string }> {
  const provider = window.AsignaProvider;
  if (!provider) {
    throw new Error('Asigna wallet is not installed. Please install it from asigna.io');
  }

  try {
    const result = await provider.connect();
    return {
      address: result.address,
      publicKey: result.publicKey,
    };
  } catch (error) {
    throw new Error(`Failed to connect to Asigna wallet: ${error}`);
  }
}

/**
 * Connect to Fordefi wallet
 */
async function connectFordefiWallet(): Promise<{ address: string; publicKey: string }> {
  const provider = window.FordefiProvider;
  if (!provider) {
    throw new Error('Fordefi wallet is not installed. Please install it from fordefi.com');
  }

  try {
    const result = await provider.connect();
    return {
      address: result.address,
      publicKey: result.publicKey,
    };
  } catch (error) {
    throw new Error(`Failed to connect to Fordefi wallet: ${error}`);
  }
}
