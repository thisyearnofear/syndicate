/**
 * ENHANCED WALLET CONNECTION HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced to use new unified wallet service
 * - DRY: Delegates to unified wallet service as single source of truth
 * - CLEAN: Clear separation of concerns
 * - MODULAR: Composable with new domain structure
 * - FIX: Now properly syncs EVM and non-EVM wallet state
 */

import { useUnifiedWallet } from '@/domains/wallet/services/unifiedWalletService';
import { useWalletContext } from '@/context/WalletContext';

/**
 * ENHANCEMENT FIRST: Enhanced wallet connection hook
 * Unified interface for all wallet types (EVM, Solana, Stacks, NEAR)
 * 
 * STATE CONSOLIDATION:
 * - Primary source: WalletContext (all wallet types sync here)
 * - Fallback: wagmi for EVM state (syncs to context via effect)
 * - Single point of truth: state.isConnected + state.address + state.walletType
 */
export function useWalletConnection() {
  const { state } = useWalletContext();
  const { connect, disconnect, switchChain, clearError } = useUnifiedWallet();

  // The context now handles syncing with wagmi via SYNC_WAGMI action
  // So we can rely on state.isConnected as the single source of truth

  return {
    // State properties
    isConnected: state.isConnected,
    address: state.address,
    walletType: state.walletType,
    chainId: state.chainId,
    isConnecting: state.isConnecting,
    error: state.error,
    lastConnectedAt: state.lastConnectedAt,
    mirrorAddress: state.mirrorAddress,
    isModalOpen: state.isModalOpen,
    
    // Service methods
    connect,
    disconnect,
    switchChain,
    clearError,
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