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

// =============================================================================
// TYPES
// =============================================================================

export type WalletType = 'metamask' | 'phantom' | 'social' | 'near';

// =============================================================================
// WALLET DETECTION
// =============================================================================

export const WalletTypes = {
  METAMASK: 'metamask' as const,
  PHANTOM: 'phantom' as const,
  SOCIAL: 'social' as const,
  NEAR: 'near' as const,
};

/**
 * CLEAN: Detect available wallets
 */
export function getAvailableWallets(): WalletType[] {
  const available: WalletType[] = [];

  // Check for MetaMask
  if (typeof window !== 'undefined' && (window as any).ethereum?.isMetaMask) {
    available.push(WalletTypes.METAMASK);
  }

  // Check for Phantom
  if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
    available.push(WalletTypes.PHANTOM);
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
        isAvailable: typeof window !== 'undefined' && !!(window as any).ethereum?.isMetaMask,
        isInstalled: typeof window !== 'undefined' && !!(window as any).ethereum?.isMetaMask,
        downloadUrl: 'https://metamask.io/download/',
      };

    case WalletTypes.PHANTOM:
      return {
        isAvailable: typeof window !== 'undefined' && !!(window as any).solana?.isPhantom,
        isInstalled: typeof window !== 'undefined' && !!(window as any).solana?.isPhantom,
        downloadUrl: 'https://phantom.app/',
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

    dispatch({ type: 'CONNECT_START' });

    try {
      const walletStatus = getWalletStatus(walletType);

      if (!walletStatus.isAvailable) {
        throw createError(
          'WALLET_NOT_AVAILABLE',
          `${walletType} wallet is not available. Please install it first.`,
          { downloadUrl: walletStatus.downloadUrl }
        );
      }

      let address: string;
      let chainId: number;

      switch (walletType) {
        case WalletTypes.METAMASK:
          // Check if MetaMask is available
          if (!(window as any).ethereum) {
            throw createError('WALLET_NOT_FOUND', 'MetaMask is not installed. Please install it from metamask.io');
          }

          try {
            const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' }) as string[];
            if (!accounts || accounts.length === 0) {
              throw createError('WALLET_ERROR', 'No accounts found. Please unlock MetaMask.');
            }

            const network = await (window as any).ethereum.request({ method: 'eth_chainId' });
            const numericChainId = parseInt((network as string) || '0x1', 16);
            
            // Check if we're on Base network (8453), if not, try to switch
            if (numericChainId !== 8453) {
              try {
                await (window as any).ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: '0x2105' }], // Base mainnet in hex
                });
              } catch (switchError: any) {
                // If Base network is not added to wallet, add it
                if (switchError.code === 4902) {
                  await (window as any).ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: '0x2105',
                      chainName: 'Base',
                      nativeCurrency: {
                        name: 'Ethereum',
                        symbol: 'ETH',
                        decimals: 18,
                      },
                      rpcUrls: ['https://mainnet.base.org'],
                      blockExplorerUrls: ['https://basescan.org'],
                    }],
                  });
                } else {
                  throw switchError;
                }
              }
            }

            // Initialize Web3 service after successful connection
            try {
              // Import web3Service statically to avoid webpack issues
              const { web3Service } = await import('@/services/web3Service');
              const initialized = await web3Service.initialize();
              
              if (!initialized) {
                console.warn('Web3 service initialization failed');
                // Don't throw here - wallet connection can work without Web3 service for basic functionality
              }
            } catch (importError) {
              console.warn('Web3 service not available:', importError);
              // Don't throw here - wallet connection can work without Web3 service for basic functionality
            }

            address = accounts[0] || '';
            chainId = 8453; // Base network
          } catch (error: any) {
            if (error.code === 4001) {
              throw createError('CONNECTION_REJECTED', 'Connection rejected by user');
            }
            throw createError('CONNECTION_FAILED', `Failed to connect to MetaMask: ${error.message}`);
          }
          break;

        case WalletTypes.PHANTOM:
          // Check if Phantom is installed
          if (!(window as any).phantom?.ethereum) {
            throw createError('WALLET_NOT_FOUND', 'Phantom wallet is not installed. Please install it from phantom.app');
          }

          try {
            // Request account access
            const phantomAccounts = await (window as any).phantom.ethereum.request({
              method: 'eth_requestAccounts',
            }) as string[];

            if (!phantomAccounts || phantomAccounts.length === 0) {
              throw createError('CONNECTION_REJECTED', 'No accounts found. Please unlock your Phantom wallet.');
            }

            address = phantomAccounts[0];

            // Check if we're on the correct network (Base - 8453)
            const phantomChainId = await (window as any).phantom.ethereum.request({
              method: 'eth_chainId',
            }) as string;

            const currentChainId = parseInt(phantomChainId, 16);
            
            if (currentChainId !== 8453) {
              try {
                // Try to switch to Base network
                await (window as any).phantom.ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: '0x2105' }], // Base mainnet in hex
                });
              } catch (switchError: any) {
                // If the chain hasn't been added to Phantom yet, add it
                if (switchError.code === 4902) {
                  await (window as any).phantom.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: '0x2105',
                      chainName: 'Base',
                      nativeCurrency: {
                        name: 'Ethereum',
                        symbol: 'ETH',
                        decimals: 18,
                      },
                      rpcUrls: ['https://mainnet.base.org'],
                      blockExplorerUrls: ['https://basescan.org'],
                    }],
                  });
                } else {
                  throw switchError;
                }
              }
            }

            // Initialize Web3 service
            try {
              const { web3Service } = await import('@/services/web3Service');
              const initialized = await web3Service.initialize();
              
              if (!initialized) {
                console.warn('Web3 service initialization failed for Phantom');
              }
            } catch (web3Error) {
              console.warn('Web3 service initialization failed:', web3Error);
              // Continue without Web3 service for basic wallet functionality
            }

            chainId = 8453; // Base network
          } catch (error: any) {
            if (error.code === 4001) {
              throw createError('CONNECTION_REJECTED', 'Connection rejected by user');
            }
            throw createError('CONNECTION_FAILED', `Failed to connect to Phantom: ${error.message}`);
          }
          break;



        case WalletTypes.SOCIAL:
          try {
            // For now, show coming soon message for social login
            throw createError('WALLET_NOT_SUPPORTED', 'Social login is coming soon. Please use MetaMask for now.');
          } catch (error: any) {
            console.error('Social login error:', error);
            throw error;
          }
          break;

        case WalletTypes.NEAR:
          try {
            // For now, show coming soon message for NEAR wallet
            throw createError('WALLET_NOT_SUPPORTED', 'NEAR wallet is coming soon. Please use MetaMask for now.');
          } catch (error: any) {
            console.error('NEAR wallet error:', error);
            throw error;
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
  }, [dispatch]);

  /**
   * CLEAN: Disconnect wallet
   */
  const disconnect = useCallback(async () => {
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
      if (state.walletType === WalletTypes.METAMASK && (window as any).ethereum) {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });

        dispatch({ type: 'NETWORK_CHANGED', payload: { chainId: targetChainId } });
      } else if (state.walletType === WalletTypes.PHANTOM && (window as any).phantom?.ethereum) {
        await (window as any).phantom.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });

        dispatch({ type: 'NETWORK_CHANGED', payload: { chainId: targetChainId } });
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