/**
 * SHARED POLLING HOOK
 * 
 * Core Principles Applied:
 * - DRY: Single polling implementation for all cross-chain purchases
 * - MODULAR: Reusable across useCrossChainPurchase and useSimplePurchase
 * - PERFORMANT: Adaptive polling with exponential backoff
 * - CLEAN: Clear separation of concerns
 */

import { useEffect, useRef, useState } from 'react';
import type { TrackerStatus } from '@/components/bridge/CrossChainTracker';

const BASE_POLLING_INTERVAL = 5000; // 5 seconds
const MAX_POLLING_INTERVAL = 30000; // 30 seconds max

interface PurchaseStatusResponse {
  status: string;
  baseTxId?: string;
  error?: string;
  receipt?: {
    stacksExplorer?: string;
    sourceExplorer?: string;
    baseExplorer?: string | null;
    megapotApp?: string | null;
  };
}

interface UsePurchasePollingOptions {
  /** Transaction ID to poll for */
  txId: string | null;

  /** Current status - stops polling on terminal states */
  currentStatus: TrackerStatus;

  /** Callback when status changes */
  onStatusChange?: (data: PurchaseStatusResponse) => void;

  /** Custom polling interval (default: 5000ms) */
  interval?: number;

  /** Enable adaptive polling (slower over time) */
  adaptivePolling?: boolean;
}

/**
 * Hook that polls /api/purchase-status for transaction updates
 * Automatically stops on terminal states (complete, error)
 */
export function usePurchasePolling({
  txId,
  currentStatus,
  onStatusChange,
  interval = BASE_POLLING_INTERVAL,
  adaptivePolling = true,
}: UsePurchasePollingOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const isPollingRef = useRef(false);
  const lastStatusRef = useRef<string | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);

  // Keep onStatusChangeRef up to date
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    // Only poll if we have a transaction and we're in a pending state
    const shouldPoll = txId &&
      ['confirmed_source', 'confirmed_stacks', 'bridging', 'purchasing'].includes(currentStatus) &&
      currentStatus !== 'complete' &&
      currentStatus !== 'error';

    if (!shouldPoll) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isPollingRef.current = false;
      return;
    }

    // Don't start another polling chain if one is already active for this effect cycle
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    // Calculate adaptive polling interval
    const getCurrentInterval = (count: number) => {
      if (!adaptivePolling) return interval;
      if (count < 3) return BASE_POLLING_INTERVAL;
      if (count < 6) return BASE_POLLING_INTERVAL * 2;
      if (count < 10) return BASE_POLLING_INTERVAL * 3;
      return Math.min(BASE_POLLING_INTERVAL * 4, MAX_POLLING_INTERVAL);
    };

    // Polling function
    const pollStatus = async () => {
      // If the effect was cleaned up, stop the chain
      if (!isPollingRef.current) return;

      try {
        console.log(`[usePurchasePolling] Polling for txId: ${txId} (attempt ${pollCountRef.current + 1})`);

        const response = await fetch(`/api/purchase-status/${txId}`);
        if (response.ok) {
          const data: PurchaseStatusResponse = await response.json();

          // Only call callback if status actually changed
          if (data.status !== lastStatusRef.current) {
            console.log(`[usePurchasePolling] Status changed: ${lastStatusRef.current} -> ${data.status}`);
            lastStatusRef.current = data.status;
            onStatusChangeRef.current?.(data);
          }

          // Stop polling on terminal states
          if (data.status === 'complete' || data.status === 'error') {
            console.log('[usePurchasePolling] Terminal state reached, stopping poll');
            isPollingRef.current = false;
            return;
          }
        }

        // Schedule next poll
        pollCountRef.current++;
        const nextInterval = getCurrentInterval(pollCountRef.current);
        timeoutRef.current = setTimeout(pollStatus, nextInterval);
      } catch (error) {
        console.error('[usePurchasePolling] Polling error:', error);
        // Retry anyway unless stopped
        if (isPollingRef.current) {
          pollCountRef.current++;
          timeoutRef.current = setTimeout(pollStatus, getCurrentInterval(pollCountRef.current));
        }
      }
    };

    // Start the first poll
    pollStatus();

    // Cleanup
    return () => {
      isPollingRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [txId, currentStatus, interval, adaptivePolling]);

  // Return cleanup function
  return {
    stopPolling: () => {
      isPollingRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      pollCountRef.current = 0;
      lastStatusRef.current = null;
    },
    pollCount: pollCountRef.current,
  };
}
