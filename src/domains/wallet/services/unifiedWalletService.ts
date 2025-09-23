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
  if (typeof window !== 'undefined' && window.solana?.isPhantom) {
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
        isAvailable: typeof window !== 'undefined' && !!window.solana?.isPhantom,
        isInstalled: typeof window !== 'undefined' && !!window.solana?.isPhantom,
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
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          const network = await window.ethereum.request({ method: 'eth_chainId' });
          address = accounts[0];
          chainId = parseInt(network, 16);
          break;

        case WalletTypes.PHANTOM:
          const response = await window.solana.connect();
          address = response.publicKey.toString();
          chainId = 101; // Solana mainnet
          break;

        case WalletTypes.WALLETCONNECT:
          // Simulate WalletConnect connection
          await new Promise(resolve => setTimeout(resolve, 1500));
          address = `0x${Math.random().toString(16).substr(2, 40)}`;
          chainId = 1;
          break;

        case WalletTypes.SOCIAL:
          // Simulate social login
          await new Promise(resolve => setTimeout(resolve, 2000));
          address = `0x${Math.random().toString(16).substr(2, 40)}`;
          chainId = 1;
          break;

        case WalletTypes.NEAR:
          // Simulate NEAR connection
          await new Promise(resolve => setTimeout(resolve, 1500));
          address = `user${Math.random().toString(36).substr(2, 9)}.near`;
          chainId = 0; // NEAR doesn't use chainId
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
  }, []);

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
    isAnyConnected: state.isConnected,
  };
}

// =============================================================================
// TYPE AUGMENTATION
// =============================================================================

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
    };
  }
}