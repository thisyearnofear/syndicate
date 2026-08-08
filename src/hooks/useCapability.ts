/**
 * useCapability — React hook for consuming the capability registry.
 *
 * Provides convenience accessors for a given capability ID:
 *   - capability: the full Capability object
 *   - ctaState: 'enabled' | 'disabled' | 'hidden'
 *   - message: user-facing availability/risk message (null if live)
 *   - canWrite: whether mutations are allowed
 *   - canRead: whether reads are available
 *   - isTestnet: whether the capability is restricted to testnet
 *
 * Usage:
 *   const { ctaState, message, canWrite } = useCapability('xlayer_prize_pool');
 *   if (ctaState === 'hidden') return null;
 */

import { useMemo } from 'react';
import {
  getCapability,
  getCtaState,
  type Capability,
  type CapabilityId,
} from '@/config/capabilities';

export interface UseCapabilityResult {
  capability: Capability;
  ctaState: 'enabled' | 'disabled' | 'hidden';
  message: string | null;
  canWrite: boolean;
  canRead: boolean;
  isTestnet: boolean;
  isLive: boolean;
}

export function useCapability(id: CapabilityId): UseCapabilityResult {
  return useMemo(() => {
    const capability = getCapability(id);
    return {
      capability,
      ctaState: getCtaState(id),
      message: capability.availabilityMessage,
      canWrite: capability.writesEnabled,
      canRead: capability.readsEnabled,
      isTestnet: capability.testnetOnly,
      isLive: capability.status === 'live' && capability.readsEnabled && capability.writesEnabled,
    };
  }, [id]);
}
