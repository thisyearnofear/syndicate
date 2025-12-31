/**
 * UNIFIED ERC-7715 HOOK
 * 
 * Single hook for both Advanced Permissions and Smart Sessions
 * Provides complete ERC-7715 functionality
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Address } from 'viem';
import {
  getERC7715Service,
  ERC7715SupportInfo,
  ERC7715Grant,
  AdvancedPermissionGrant,
  SmartSessionGrant,
  SessionPermissionScope,
} from '@/services/erc7715Service';
import { FEATURES } from '@/config';

/**
 * Hook state
 */
export interface UseERC7715State {
  // Support
  support: ERC7715SupportInfo | null;
  isSupported: boolean;
  isFeatureEnabled: boolean;

  // Active grants (permissions + sessions)
  grants: ERC7715Grant[];
  permissions: AdvancedPermissionGrant[];
  sessions: SmartSessionGrant[];

  // UI state
  isLoading: boolean;
  isRequesting: boolean;
  error: string | null;
}

/**
 * Hook actions
 */
export interface UseERC7715Actions {
  // Permissions
  requestAdvancedPermission: (
    type: 'erc20-token-periodic' | 'native-token-periodic',
    target: Address,
    limit: bigint,
    period: 'daily' | 'weekly' | 'monthly' | 'unlimited'
  ) => Promise<AdvancedPermissionGrant | null>;
  revokePermission: (permissionId: string) => boolean;

  // Sessions
  createSmartSession: (
    permissions: SessionPermissionScope[],
    options?: {
      name?: string;
      description?: string;
      duration?: number;
      delegatedFromPermission?: string;
    }
  ) => Promise<SmartSessionGrant | null>;
  createAutoPurchaseSession: (
    permissionId: string,
    numberOfPurchases?: number
  ) => Promise<SmartSessionGrant | null>;
  deleteSession: (sessionId: string) => boolean;
  getSessionTimeRemaining: (sessionId: string) => number;

  // Utility
  clearError: () => void;
  refresh: () => void;
}

/**
 * Unified ERC-7715 hook
 */
export function useERC7715(): UseERC7715State & UseERC7715Actions {
  const [support, setSupport] = useState<ERC7715SupportInfo | null>(null);
  const [grants, setGrants] = useState<ERC7715Grant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = getERC7715Service();

  const initializationStarted = useRef(false);

  // Initialize on mount
  useEffect(() => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;

    let isMounted = true;

    const initialize = async () => {
      try {
        const supportInfo = await service.initialize();

        if (isMounted) {
          setSupport(supportInfo);
          const activeGrants = service.getActiveGrants();
          setGrants(activeGrants);
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Failed to initialize';
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Don't initialize on server-side
    if (typeof window !== 'undefined') {
      initialize();
    }

    return () => {
      isMounted = false;
    };
  }, [service]);

  // Request Advanced Permission
  const requestAdvancedPermission = useCallback(
    async (
      type: 'erc20-token-periodic' | 'native-token-periodic',
      target: Address,
      limit: bigint,
      period: 'daily' | 'weekly' | 'monthly' | 'unlimited'
    ) => {
      if (!support?.isSupported) {
        setError(support?.message || 'ERC-7715 not supported');
        return null;
      }

      setIsRequesting(true);
      setError(null);

      try {
        const permission = await service.requestAdvancedPermission(
          type,
          target,
          limit,
          period
        );

        if (permission) {
          const activeGrants = service.getActiveGrants();
          setGrants(activeGrants);
        }

        return permission;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to request permission';
        setError(message);
        return null;
      } finally {
        setIsRequesting(false);
      }
    },
    [support, service]
  );

  // Create Smart Session
  const createSmartSession = useCallback(
    async (
      permissions: SessionPermissionScope[],
      options?: {
        name?: string;
        description?: string;
        duration?: number;
        delegatedFromPermission?: string;
      }
    ) => {
      if (!support?.isSupported) {
        setError(support?.message || 'ERC-7715 not supported');
        return null;
      }

      setIsRequesting(true);
      setError(null);

      try {
        const session = await service.createSmartSession(permissions, options);

        if (session) {
          const activeGrants = service.getActiveGrants();
          setGrants(activeGrants);
        }

        return session;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create session';
        setError(message);
        return null;
      } finally {
        setIsRequesting(false);
      }
    },
    [support, service]
  );

  // Create auto-purchase batch session
  const createAutoPurchaseSession = useCallback(
    async (permissionId: string, numberOfPurchases?: number) => {
      if (!support?.isSupported) {
        setError(support?.message || 'ERC-7715 not supported');
        return null;
      }

      setIsRequesting(true);
      setError(null);

      try {
        const session = await service.createAutoPurchaseSession(permissionId, numberOfPurchases);

        if (session) {
          const activeGrants = service.getActiveGrants();
          setGrants(activeGrants);
        }

        return session;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create auto-purchase session';
        setError(message);
        return null;
      } finally {
        setIsRequesting(false);
      }
    },
    [support, service]
  );

  // Revoke permission
  const revokePermission = useCallback(
    (permissionId: string) => {
      const success = service.revokePermission(permissionId);
      if (success) {
        const activeGrants = service.getActiveGrants();
        setGrants(activeGrants);
      }
      return success;
    },
    [service]
  );

  // Delete session
  const deleteSession = useCallback(
    (sessionId: string) => {
      const success = service.deleteSession(sessionId);
      if (success) {
        const activeGrants = service.getActiveGrants();
        setGrants(activeGrants);
      }
      return success;
    },
    [service]
  );

  // Get session time remaining
  const getSessionTimeRemaining = useCallback(
    (sessionId: string) => service.getSessionTimeRemaining(sessionId),
    [service]
  );

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  // Refresh
  const refresh = useCallback(() => {
    const activeGrants = service.getActiveGrants();
    setGrants(activeGrants);
  }, [service]);

  const permissions = useMemo(() => grants
    .filter(g => g.type === 'advanced-permission')
    .map(g => g.permission!)
    .filter(Boolean), [grants]);

  const sessions = useMemo(() => grants
    .filter(g => g.type === 'smart-session')
    .map(g => g.session!)
    .filter(Boolean), [grants]);

  return useMemo(() => ({
    // State
    support,
    isSupported: support?.isSupported ?? false,
    isFeatureEnabled: FEATURES.enableERC7715SmartSessions,
    grants,
    permissions,
    sessions,
    isLoading,
    isRequesting,
    error,

    // Actions
    requestAdvancedPermission,
    revokePermission,
    createSmartSession,
    createAutoPurchaseSession,
    deleteSession,
    getSessionTimeRemaining,
    clearError,
    refresh,
  }), [
    support,
    grants,
    permissions,
    sessions,
    isLoading,
    isRequesting,
    error,
    requestAdvancedPermission,
    revokePermission,
    createSmartSession,
    createAutoPurchaseSession,
    deleteSession,
    getSessionTimeRemaining,
    clearError,
    refresh,
  ]);
}
