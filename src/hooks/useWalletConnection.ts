"use client";

/**
 * ENHANCEMENT FIRST: Simplified wallet connection hook
 * DRY: Uses unified wallet service as single source of truth
 * CLEAN: Delegates complex logic to service layer
 */

import { useUnifiedWallet } from "@/services/unifiedWalletService";

/**
 * Unified wallet connection state hook
 * ENHANCEMENT FIRST: Now uses the unified wallet service
 */
export function useWalletConnection() {
  return useUnifiedWallet();
}

// CLEAN: Re-export types for backward compatibility
export type { WalletState, WalletActions, WalletType } from "@/services/unifiedWalletService";
export { WalletTypes, getWalletStatus } from "@/services/unifiedWalletService";