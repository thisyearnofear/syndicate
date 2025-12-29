/**
 * ENHANCED WALLET CONNECTION HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced to use new unified wallet service
 * - DRY: Delegates to unified wallet service as single source of truth
 * - CLEAN: Clear separation of concerns
 * - MODULAR: Composable with new domain structure
 * - FIX: Now returns both Solana AND EVM wallet state for unified access
 */

import { useUnifiedWallet } from '@/domains/wallet/services/unifiedWalletService';
import { useWalletContext } from '@/context/WalletContext';
import { useAccount } from 'wagmi';

/**
 * ENHANCEMENT FIRST: Enhanced wallet connection hook
 * Now returns both Solana (via context) and EVM (via wagmi) wallet state
 * Single source for all wallet information
 */
export function useWalletConnection() {
  const { state } = useWalletContext();
  const { connect, disconnect, switchChain, clearError } = useUnifiedWallet();
  const { address: evmAddress, isConnected: evmConnected, connector } = useAccount();

  // DERIVED STATE: Single source of truth across all wallet types
  // This ensures that if wagmi is connected, the app reflects it even if context hasn't synced
  const isConnected = state.isConnected || evmConnected;
  
  // Consolidate address: prefer non-EVM if that's what's in context, else use EVM
  const address = state.address || evmAddress || null;
  
  // Consolidate wallet type
  let walletType = state.walletType;
  if (!walletType && evmConnected) {
    walletType = 'evm';
  }

  return {
    ...state,
    isConnected,
    address,
    walletType,
    // Methods
    connect,
    disconnect,
    switchChain,
    clearError,
    // Backward compatibility / explicit access
    evmAddress,
    evmConnected,
  };
}

// CLEAN: Re-export types for backward compatibility
export type {
  WalletType
} from '@/domains/wallet/types';

export {
  WalletTypes,
  STACKS_WALLETS
} from '@/domains/wallet/types';

export {
  getWalletStatus,
  getAvailableWallets
} from '@/domains/wallet/services/unifiedWalletService';