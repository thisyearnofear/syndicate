/**
 * ENHANCED WALLET CONNECTION HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced to use new unified wallet service
 * - DRY: Delegates to unified wallet service as single source of truth
 * - CLEAN: Clear separation of concerns
 * - MODULAR: Composable with new domain structure
 */

import { useUnifiedWallet } from '@/domains/wallet/services/unifiedWalletService';
import { useWalletContext } from '@/context/WalletContext';

/**
 * ENHANCEMENT FIRST: Enhanced wallet connection hook
 * Now uses the unified wallet service from the wallet domain
 */
export function useWalletConnection() {
  const { state } = useWalletContext();
  const { connect, disconnect, switchChain, clearError } = useUnifiedWallet();
  
  return {
    ...state,
    connect,
    disconnect,
    switchChain,
    clearError,
  };
}

// CLEAN: Re-export types for backward compatibility
export type { 
  WalletType 
} from '@/domains/wallet/services/unifiedWalletService';

export { 
  WalletTypes, 
  getWalletStatus,
  getAvailableWallets 
} from '@/domains/wallet/services/unifiedWalletService';