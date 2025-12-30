/**
 * USE ADVANCED PERMISSIONS HOOK (DELEGATING WRAPPER)
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Delegates to unified useERC7715 hook
 * - DRY: Single source of truth (useERC7715)
 * - CLEAN: Maintains backward-compatible API
 * - MODULAR: Thin wrapper, no duplicate logic
 * 
 * This hook now delegates to the unified useERC7715 hook.
 * It maintains backward compatibility with the autopurchase feature
 * while using the single source of truth for all ERC-7715 operations.
 * 
 * MIGRATION NOTE: New code should import and use useERC7715 directly.
 * This hook exists only for backward compatibility.
 */

import { useCallback, useEffect, useState } from 'react';
import { useWalletClient } from 'wagmi';
import { useERC7715 } from './useERC7715';
import { useWalletConnection } from './useWalletConnection';
import { PERMISSION_PRESETS } from '@/domains/wallet/services/advancedPermissionsService';
import type { AdvancedPermission, AutoPurchaseConfig } from '@/domains/wallet/types';

// =============================================================================
// TYPES (BACKWARD COMPATIBILITY)
// =============================================================================

export interface UseAdvancedPermissionsState {
  permission: AdvancedPermission | null;
  isActive: boolean;
  isLoading: boolean;
  isRequesting: boolean;
  error: string | null;
  autoPurchaseConfig: AutoPurchaseConfig | null;
}

export interface UseAdvancedPermissionsActions {
  requestPermission: (request: any) => Promise<boolean>;
  requestPresetPermission: (preset: 'weekly' | 'monthly') => Promise<boolean>;
  revokePermission: () => void;
  saveAutoPurchaseConfig: (config: AutoPurchaseConfig) => void;
  clearAutoPurchaseConfig: () => void;
  reloadPermission: () => Promise<void>;
  clearError: () => void;
}

// =============================================================================
// HOOK (DELEGATING WRAPPER)
// =============================================================================

const STORAGE_KEY_PERMISSION = 'syndicate:advanced-permission';
const STORAGE_KEY_AUTO_CONFIG = 'syndicate:auto-purchase-config';

export function useAdvancedPermissions(): UseAdvancedPermissionsState & UseAdvancedPermissionsActions {
  // Delegate to unified ERC-7715 hook
  const erc7715 = useERC7715();
  const { data: walletClient } = useWalletClient();
  const { isConnected } = useWalletConnection();

  // Local state for backward compatibility
  const [autoPurchaseConfig, setAutoPurchaseConfig] = useState<AutoPurchaseConfig | null>(null);

  // Load stored config on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTO_CONFIG);
      if (stored) {
        setAutoPurchaseConfig(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load auto-purchase config:', error);
    }
  }, []);

  // Convert erc7715 permissions to old AdvancedPermission type
  const permission: AdvancedPermission | null = erc7715.permissions.length > 0
    ? {
        permissionId: erc7715.permissions[0].id,
        scope: erc7715.permissions[0].type,
        token: erc7715.permissions[0].target,
        spender: '0x0000000000000000000000000000000000000000', // Placeholder
        limit: erc7715.permissions[0].limit,
        remaining: erc7715.permissions[0].limit - erc7715.permissions[0].spent,
        period: erc7715.permissions[0].period,
        grantedAt: erc7715.permissions[0].grantedAt,
        expiresAt: erc7715.permissions[0].expiresAt,
        isActive: erc7715.permissions[0].isActive,
      }
    : null;

  // Request permission (delegates to erc7715)
  const requestPermission = useCallback(
    async (request: any): Promise<boolean> => {
      if (!erc7715.isSupported) {
        return false;
      }

      const result = await erc7715.requestAdvancedPermission(
        request.scope || 'erc20:spend',
        request.tokenAddress,
        request.limit,
        request.period
      );

      return !!result;
    },
    [erc7715]
  );

  // Request preset permission
  const requestPresetPermission = useCallback(
    async (preset: 'weekly' | 'monthly'): Promise<boolean> => {
      const presetConfig = PERMISSION_PRESETS[preset];
      if (!presetConfig) return false;

      return requestPermission({
        scope: presetConfig.scope,
        tokenAddress: presetConfig.tokenAddress,
        limit: presetConfig.limit,
        period: presetConfig.period,
        description: presetConfig.description,
      });
    },
    [requestPermission]
  );

  // Revoke permission
  const revokePermission = useCallback(() => {
    if (permission) {
      erc7715.revokePermission(permission.permissionId);
    }
  }, [permission, erc7715]);

  // Save auto-purchase config
  const saveAutoPurchaseConfig = useCallback((config: AutoPurchaseConfig) => {
    setAutoPurchaseConfig(config);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_AUTO_CONFIG, JSON.stringify(config));
      } catch (error) {
        console.error('Failed to save auto-purchase config:', error);
      }
    }
  }, []);

  // Clear auto-purchase config
  const clearAutoPurchaseConfig = useCallback(() => {
    setAutoPurchaseConfig(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_AUTO_CONFIG);
      } catch (error) {
        console.error('Failed to clear auto-purchase config:', error);
      }
    }
  }, []);

  // Reload permission
  const reloadPermission = useCallback(async () => {
    erc7715.refresh();
  }, [erc7715]);

  // Clear error
  const clearError = useCallback(() => {
    erc7715.clearError();
  }, [erc7715]);

  return {
    // State
    permission,
    isActive: permission?.isActive ?? false,
    isLoading: erc7715.isLoading,
    isRequesting: erc7715.isRequesting,
    error: erc7715.error,
    autoPurchaseConfig,

    // Actions
    requestPermission,
    requestPresetPermission,
    revokePermission,
    saveAutoPurchaseConfig,
    clearAutoPurchaseConfig,
    reloadPermission,
    clearError,
  };
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Hook to check if user can enable auto-purchase
 */
export function useCanEnableAutoPurchase(): {
  canEnable: boolean;
  reason?: string;
  chainRequirement?: string;
} {
  const { isConnected, walletType } = useWalletConnection();
  const { permission } = useAdvancedPermissions();
  const { isSupported, support } = useERC7715();

  if (!isConnected) {
    return { canEnable: false, reason: 'Wallet not connected' };
  }

  if (walletType !== 'evm') {
    return {
      canEnable: false,
      reason: 'Advanced Permissions only available on MetaMask',
      chainRequirement: 'Supports Base, Ethereum, Avalanche',
    };
  }

  if (!isSupported) {
    return {
      canEnable: false,
      reason: support?.message || 'Advanced Permissions not supported',
      chainRequirement: support?.reason,
    };
  }

  if (permission && permission.isActive) {
    return {
      canEnable: false,
      reason: 'Auto-purchase already enabled',
    };
  }

  return { canEnable: true };
}

/**
 * Hook to get auto-purchase state
 */
export function useAutoPurchaseState() {
  const { autoPurchaseConfig } = useAdvancedPermissions();

  return {
    isEnabled: autoPurchaseConfig?.enabled ?? false,
    config: autoPurchaseConfig,
    nextExecution: autoPurchaseConfig?.nextExecution,
  };
}
