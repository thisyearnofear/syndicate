/**
 * UNIFIED WALLET SERVICE
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced existing wallet connection logic
 * - DRY: Single source of truth for all wallet interactions
 * - CLEAN: Clear separation of wallet provider logic
 * - MODULAR: Composable wallet service
 */

import { useState, useCallback, useEffect } from 'react';
import { createError } from '@/shared/utils';

// =============================================================================
// TYPES
// =============================================================================

export type WalletType = 'metamask' | 'phantom' | 'walletconnect' | 'social' | 'near';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  walletType: WalletType | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
}

export interface WalletActions {
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  clearError: () => void;
}

// =============================================================================
// WALLET DETECTION
// =============================================================================

export const WalletTypes = {
  METAMASK: 'metamask' as const,
  PHANTOM: 'phantom' as const,
  WALLETCONNECT: 'walletconnect' as const,
  SOCIAL: 'social' as const,
  NEAR: 'near' as const,
};

/**
 * CLEAN: Detect available wallets
 */
export function getAvailableWallets(): WalletType[] {
  const available: WalletType[] = [];

  // Check for MetaMask
  if (typeof window !== 'undefined' && window.ethereum?.isMetaMask) {
    available.push(WalletTypes.METAMASK);
  }

  // Check for Phantom
  if (typeof window !== 'undefined' && (window as any).solana?.isPhantom) {
    available.push(WalletTypes.PHANTOM);
  }

  // WalletConnect is always available
  available.push(WalletTypes.WALLETCONNECT);

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
        isAvailable: typeof window !== 'undefined' && !!(window as any).solana?.isPhantom,
        isInstalled: typeof window !== 'undefined' && !!(window as any).solana?.isPhantom,
        downloadUrl: 'https://phantom.app/',
      };

    case WalletTypes.WALLETCONNECT:
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
// WALLET SERVICE HOOK
// =============================================================================

/**
 * ENHANCEMENT FIRST: Enhanced unified wallet hook
 */
export function useUnifiedWallet(): WalletState & WalletActions {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    walletType: null,
    chainId: null,
    isConnecting: false,
    error: null,
  });

  /**
   * PERFORMANT: Connect to wallet with error handling
   */
  const connect = useCallback(async (walletType: WalletType) => {
    if (state.isConnecting) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

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
          const accounts = await window.ethereum!.request({ method: 'eth_requestAccounts' }) as string[];
          if (!accounts || accounts.length === 0) {
            throw createError('WALLET_ERROR', 'No accounts found. Please unlock MetaMask.');
          }

          const network = await window.ethereum!.request({ method: 'eth_chainId' });
          const numericChainId = parseInt((network as string) || '0x1', 16);
          
          // Check if we're on Base network (8453), if not, try to switch
          if (numericChainId !== 8453) {
            try {
              await window.ethereum!.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x2105' }], // Base mainnet in hex
              });
            } catch (switchError: any) {
              // If Base network is not added to wallet, add it
              if (switchError.code === 4902) {
                await window.ethereum!.request({
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
              throw createError('WEB3_ERROR', 'Failed to initialize Web3 service. Please try again.');
            }
          } catch (importError) {
            console.warn('Web3 service not available:', importError);
            // Don't throw here - wallet connection can work without Web3 service for basic functionality
          }

          address = accounts[0] || '';
          chainId = 8453; // Base network
          break;

        case WalletTypes.PHANTOM:
          // Check if Phantom is installed
          if (!window.phantom?.ethereum) {
            throw createError('WALLET_NOT_FOUND', 'Phantom wallet is not installed. Please install it from phantom.app');
          }

          try {
            // Request account access
            const phantomAccounts = await window.phantom.ethereum.request({
              method: 'eth_requestAccounts',
            }) as string[];

            if (!phantomAccounts || phantomAccounts.length === 0) {
              throw createError('CONNECTION_REJECTED', 'No accounts found. Please unlock your Phantom wallet.');
            }

            address = phantomAccounts[0];

            // Check if we're on the correct network (Base - 8453)
            const phantomChainId = await window.phantom.ethereum.request({
              method: 'eth_chainId',
            }) as string;

            const currentChainId = parseInt(phantomChainId, 16);
            
            if (currentChainId !== 8453) {
              try {
                // Try to switch to Base network
                await window.phantom.ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: '0x2105' }], // Base mainnet in hex
                });
              } catch (switchError: any) {
                // If the chain hasn't been added to Phantom yet, add it
                if (switchError.code === 4902) {
                  await window.phantom.ethereum.request({
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

        case WalletTypes.WALLETCONNECT:
          try {
            // For now, show coming soon message for WalletConnect
            throw createError('WALLET_NOT_SUPPORTED', 'WalletConnect is coming soon. Please use MetaMask for now.');
          } catch (error: any) {
            console.error('WalletConnect error:', error);
            throw error;
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

      setState(prev => ({
        ...prev,
        isConnected: true,
        address,
        walletType,
        chainId,
        isConnecting: false,
        error: null,
      }));

      // Store connection in localStorage for persistence
      localStorage.setItem('wallet_connection', JSON.stringify({
        walletType,
        address,
        chainId,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [state.isConnecting]);

  /**
   * CLEAN: Disconnect wallet
   */
  const disconnect = useCallback(async () => {
    setState({
      isConnected: false,
      address: null,
      walletType: null,
      chainId: null,
      isConnecting: false,
      error: null,
    });

    // Clear stored connection
    localStorage.removeItem('wallet_connection');
  }, []);

  /**
   * ENHANCEMENT FIRST: Switch chain with error handling
   */
  const switchChain = useCallback(async (targetChainId: number) => {
    if (!state.isConnected || !state.walletType) {
      throw createError('WALLET_NOT_CONNECTED', 'No wallet connected');
    }

    try {
      if (state.walletType === WalletTypes.METAMASK) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });

        setState(prev => ({ ...prev, chainId: targetChainId }));
      } else {
        throw createError('UNSUPPORTED_OPERATION', 'Chain switching not supported for this wallet');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch chain';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.isConnected, state.walletType]);

  /**
   * CLEAN: Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * PERFORMANT: Restore connection on mount
   */
  useEffect(() => {
    const stored = localStorage.getItem('wallet_connection');
    if (stored) {
      try {
        const { walletType, address, chainId } = JSON.parse(stored);
        const walletStatus = getWalletStatus(walletType);

        if (walletStatus.isAvailable) {
          setState(prev => ({
            ...prev,
            isConnected: true,
            address,
            walletType,
            chainId,
          }));
        } else {
          localStorage.removeItem('wallet_connection');
        }
      } catch (error) {
        localStorage.removeItem('wallet_connection');
      }
    }
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    switchChain,
    clearError,
    // Computed properties
  };
}

// =============================================================================
// TYPE AUGMENTATION
// =============================================================================

// declare global {
//   interface Window {
//     ethereum?: any;
//     solana?: any;
//   }
// }