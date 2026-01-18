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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  useEffect(() => {
    // Only poll if we have a transaction and we're in a pending state
    const shouldPoll = txId && 
      ['confirmed_source', 'confirmed_stacks', 'bridging', 'purchasing'].includes(currentStatus) &&
      currentStatus !== 'complete' &&
      currentStatus !== 'error';

    if (!shouldPoll) {
      // Clean up polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setPollCount(0);
      }
      return;
    }

    // Calculate adaptive polling interval
    const getCurrentInterval = () => {
      if (!adaptivePolling) return interval;
      
      // Exponential backoff: increase interval as time passes
      // First 3 polls: 5s, Next 3 polls: 10s, After that: 15s, Max: 30s
      if (pollCount < 3) return BASE_POLLING_INTERVAL;
      if (pollCount < 6) return BASE_POLLING_INTERVAL * 2;
      if (pollCount < 10) return BASE_POLLING_INTERVAL * 3;
      return Math.min(BASE_POLLING_INTERVAL * 4, MAX_POLLING_INTERVAL);
    };

    // Polling function
    const pollStatus = async () => {
      try {
        console.log(`[usePurchasePolling] Polling for txId: ${txId} (attempt ${pollCount + 1})`);
        
        const response = await fetch(`/api/purchase-status/${txId}`);
        if (response.ok) {
          const data: PurchaseStatusResponse = await response.json();
          
          // Only call callback if status actually changed
          if (data.status !== lastStatus) {
            console.log(`[usePurchasePolling] Status changed: ${lastStatus} -> ${data.status}`);
            setLastStatus(data.status);
            onStatusChange?.(data);
          }
          
          // Stop polling on terminal states
          if (data.status === 'complete' || data.status === 'error') {
            console.log('[usePurchasePolling] Terminal state reached, stopping poll');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
              setPollCount(0);
            }
          }
        }
        
        setPollCount(prev => prev + 1);
      } catch (error) {
        console.error('[usePurchasePolling] Polling error:', error);
        // Don't stop polling on transient errors
        setPollCount(prev => prev + 1);
      }
    };

    // Initial poll
    pollStatus();

    // Set up interval with adaptive timing
    const currentInterval = getCurrentInterval();
    console.log(`[usePurchasePolling] Setting interval: ${currentInterval}ms`);
    
    pollingIntervalRef.current = setInterval(pollStatus, currentInterval);

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [txId, currentStatus, onStatusChange, interval, adaptivePolling, pollCount, lastStatus]);

  // Return cleanup function
  return {
    stopPolling: () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setPollCount(0);
        setLastStatus(null);
      }
    },
    pollCount,
  };
}
