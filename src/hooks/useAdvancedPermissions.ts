/**
 * USE ADVANCED PERMISSIONS HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Wraps advancedPermissionsService for UI components
 * - DRY: Single hook for all permission operations
 * - CLEAN: Clear state management and error handling
 * - MODULAR: Composable hook with straightforward API
 * - PERFORMANT: Caches permissions, minimizes re-renders
 * 
 * Provides:
 * - Request permission from user
 * - Manage permission state
 * - Check permission validity
 * - Load/save permission config
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWalletClient } from 'wagmi';
import { advancedPermissionsService, PERMISSION_PRESETS } from '@/domains/wallet/services/advancedPermissionsService';
import { useWalletConnection } from './useWalletConnection';
import type { AdvancedPermission, PermissionRequest, AutoPurchaseConfig } from '@/domains/wallet/types';
import { CONTRACTS } from '@/config';

// =============================================================================
// TYPES
// =============================================================================

export interface UseAdvancedPermissionsState {
  // Permission state
  permission: AdvancedPermission | null;
  isActive: boolean;
  
  // UI state
  isLoading: boolean;
  isRequesting: boolean;
  error: string | null;
  
  // Auto-purchase config
  autoPurchaseConfig: AutoPurchaseConfig | null;
}

export interface UseAdvancedPermissionsActions {
  // Permission operations
  requestPermission: (request: PermissionRequest) => Promise<boolean>;
  requestPresetPermission: (preset: 'weekly' | 'monthly') => Promise<boolean>;
  revokePermission: () => void;
  
  // Config operations
  saveAutoPurchaseConfig: (config: AutoPurchaseConfig) => void;
  clearAutoPurchaseConfig: () => void;
  
  // Utility
  reloadPermission: () => Promise<void>;
  clearError: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

const STORAGE_KEY_PERMISSION = 'syndicate:advanced-permission';
const STORAGE_KEY_AUTO_CONFIG = 'syndicate:auto-purchase-config';

export function useAdvancedPermissions(): UseAdvancedPermissionsState & UseAdvancedPermissionsActions {
  // State
  const [permission, setPermission] = useState<AdvancedPermission | null>(null);
  const [autoPurchaseConfig, setAutoPurchaseConfig] = useState<AutoPurchaseConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallet connection
  const { isConnected, walletType, address } = useWalletConnection();
  const { data: walletClient } = useWalletClient();
  
  // Track if service is initialized
  const serviceInitialized = useRef(false);

  // CLEAN: Initialize service with wallet client when available
  useEffect(() => {
    if (!walletClient || walletType !== 'evm' || serviceInitialized.current) {
      return;
    }

    try {
      advancedPermissionsService.init(walletClient);
      serviceInitialized.current = true;
      console.log('Advanced Permissions Service initialized');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to initialize Advanced Permissions Service:', message);
      setError(`Advanced Permissions not supported: ${message}`);
    }
  }, [walletClient, walletType]);

  // PERFORMANT: Load saved permission from storage on mount
  useEffect(() => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      // Load from localStorage
      const savedPermission = localStorage.getItem(STORAGE_KEY_PERMISSION);
      const savedConfig = localStorage.getItem(STORAGE_KEY_AUTO_CONFIG);

      if (savedPermission) {
        try {
          const parsed = JSON.parse(savedPermission);
          setPermission(parsed);
        } catch (e) {
          console.error('Failed to parse saved permission:', e);
          localStorage.removeItem(STORAGE_KEY_PERMISSION);
        }
      }

      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          setAutoPurchaseConfig(parsed);
        } catch (e) {
          console.error('Failed to parse saved config:', e);
          localStorage.removeItem(STORAGE_KEY_AUTO_CONFIG);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // CLEAN: Request permission from user
  const requestPermission = useCallback(
    async (request: PermissionRequest): Promise<boolean> => {
      if (!isConnected) {
        setError('Wallet not connected');
        return false;
      }

      if (!serviceInitialized.current) {
        setError('Advanced Permissions not initialized. Please reconnect wallet.');
        return false;
      }

      setIsRequesting(true);
      setError(null);

      try {
        // Request permission from service (already initialized)
        const result = await advancedPermissionsService.requestPermission(request);

        if (result.success && result.permission) {
          // Save to state and localStorage
          setPermission(result.permission);
          localStorage.setItem(STORAGE_KEY_PERMISSION, JSON.stringify(result.permission));
          return true;
        } else {
          const errorMsg = result.error || 'Failed to request permission';
          setError(errorMsg);
          return false;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Permission request failed: ${message}`);
        return false;
      } finally {
        setIsRequesting(false);
      }
    },
    [isConnected]
  );

  // MODULAR: Request preset permission
  const requestPresetPermission = useCallback(
    async (preset: 'weekly' | 'monthly'): Promise<boolean> => {
      const presetConfig = preset === 'weekly' 
        ? PERMISSION_PRESETS.STANDARD_WEEKLY 
        : PERMISSION_PRESETS.AGGRESSIVE_MONTHLY;

      const request: PermissionRequest = {
        scope: 'erc20:spend',
        tokenAddress: CONTRACTS.usdc,
        ...presetConfig,
      };

      return requestPermission(request);
    },
    [requestPermission]
  );

  // CLEAN: Revoke permission
  const revokePermission = useCallback(() => {
    setPermission(null);
    setAutoPurchaseConfig(null);
    localStorage.removeItem(STORAGE_KEY_PERMISSION);
    localStorage.removeItem(STORAGE_KEY_AUTO_CONFIG);
    setError(null);
  }, []);

  // CLEAN: Save auto-purchase config
  const saveAutoPurchaseConfig = useCallback((config: AutoPurchaseConfig) => {
    setAutoPurchaseConfig(config);
    localStorage.setItem(STORAGE_KEY_AUTO_CONFIG, JSON.stringify(config));
  }, []);

  // CLEAN: Clear auto-purchase config
  const clearAutoPurchaseConfig = useCallback(() => {
    setAutoPurchaseConfig(null);
    localStorage.removeItem(STORAGE_KEY_AUTO_CONFIG);
  }, []);

  // PERFORMANT: Reload permission state
  const reloadPermission = useCallback(async () => {
    if (!permission) return;

    setIsLoading(true);
    try {
      // TODO: In Phase 3, verify permission is still valid on-chain
      // For now, just verify it's not expired based on local state
      if (permission.expiresAt && permission.expiresAt < Date.now()) {
        setError('Permission has expired');
        setPermission(null);
        localStorage.removeItem(STORAGE_KEY_PERMISSION);
        return;
      }

      // Permission is still valid
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [permission]);

  // CLEAN: Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // PERFORMANT: Check if permission is active
  const isActive = permission?.isActive ?? false;

  return {
    // State
    permission,
    isActive,
    isLoading,
    isRequesting,
    error,
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
// UTILITY HOOK: Check if user can enable auto-purchase
// =============================================================================

export function useCanEnableAutoPurchase(): {
  canEnable: boolean;
  reason?: string;
  chainRequirement?: string;
} {
  const { isConnected, walletType, chainId } = useWalletConnection();
  const { permission } = useAdvancedPermissions();

  // CLEAN: Check prerequisites for Advanced Permissions (ERC-7715)
  // Requires: MetaMask Flask, Base/Ethereum/Avalanche with EIP-7702 support
  
  if (!isConnected) {
    return { canEnable: false, reason: 'Wallet not connected' };
  }

  // Only MetaMask supports Advanced Permissions (ERC-7715)
  if (walletType !== 'evm') {
    return { 
      canEnable: false, 
      reason: 'Advanced Permissions only available on MetaMask',
      chainRequirement: 'Supports Base, Ethereum, Avalanche'
    };
  }

  // Check if on supported chain (must be EIP-7702)
  const supportedChains = [8453, 1, 43114]; // Base, Ethereum, Avalanche
  const numChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
  if (numChainId && !supportedChains.includes(numChainId)) {
    return {
      canEnable: false,
      reason: 'Switch to Base, Ethereum, or Avalanche',
      chainRequirement: 'Current chain not supported for Advanced Permissions'
    };
  }

  if (permission && permission.isActive) {
    return { 
      canEnable: false, 
      reason: 'Auto-purchase already enabled' 
    };
  }

  return { canEnable: true };
}

// =============================================================================
// UTILITY HOOK: Auto-purchase state
// =============================================================================

export function useAutoPurchaseState(): {
  isEnabled: boolean;
  nextExecution?: number;
  lastExecution?: number;
  frequency?: string;
  amountPerPeriod?: bigint;
} {
  const { autoPurchaseConfig, permission } = useAdvancedPermissions();

  if (!autoPurchaseConfig || !permission?.isActive) {
    return { isEnabled: false };
  }

  return {
    isEnabled: autoPurchaseConfig.enabled,
    nextExecution: autoPurchaseConfig.nextExecution,
    lastExecution: autoPurchaseConfig.lastExecuted,
    frequency: autoPurchaseConfig.frequency,
    amountPerPeriod: autoPurchaseConfig.amountPerPeriod,
  };
}
