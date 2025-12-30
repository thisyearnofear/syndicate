/**
 * DEPRECATED: Use useERC7715() from @/hooks/useERC7715 instead
 * 
 * This hook is kept for backward compatibility only
 * It provides a simpler interface for just checking support
 */

import { useERC7715 } from './useERC7715';

export function useERC7715Support() {
  const { support, isSupported, isFeatureEnabled, isLoading } = useERC7715();

  return {
    isSupported,
    reason: support?.reason,
    message: support?.message,
    minimumVersion: support?.minimumVersion,
    upgradeUrl: support?.upgradeUrl,
    isLoading,
    isFeatureEnabled,
    isAvailable: isSupported && isFeatureEnabled,
  };
}
