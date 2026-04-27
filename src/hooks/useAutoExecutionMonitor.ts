/**
 * AUTO-EXECUTION MONITOR HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Built on useAdvancedPermissions hook
 * - PERFORMANT: Uses localStorage, exponential backoff polling
 * - CLEAN: Single responsibility - monitor execution status
 * - MODULAR: Optional hook, doesn't break existing code
 * 
 * Monitors auto-purchase execution and notifies user of:
 * - Scheduled upcoming purchase
 * - Purchase completed successfully
 * - Purchase failed (with error)
 * - Next execution scheduled
 */

import { useState, useCallback, useRef } from 'react';
import { useAdvancedPermissions } from './useAdvancedPermissions';
import { useVisibilityPolling } from '@/lib/useVisibilityPolling';
import { permittedTicketExecutor } from '@/services/automation/permittedTicketExecutor';

interface ExecutionEvent {
  timestamp: number;
  type: 'scheduled' | 'executing' | 'success' | 'failed';
  txHash?: string;
  error?: string;
  nextExecution?: number;
}

interface ExecutionMonitorState {
  // Last known execution event
  lastEvent: ExecutionEvent | null;
  
  // Upcoming execution
  nextExecutionIn: number | null; // milliseconds until next execution
  
  // Polling state
  isMonitoring: boolean;
  lastPollTime: number | null;
  
  // Execution history
  recentEvents: ExecutionEvent[];
}

export function useAutoExecutionMonitor() {
  const { autoPurchaseConfig, permission } = useAdvancedPermissions();
  const executingRef = useRef(false);
  
  const [state, setState] = useState<ExecutionMonitorState>({
    lastEvent: null,
    nextExecutionIn: null,
    isMonitoring: false,
    lastPollTime: null,
    recentEvents: [],
  });

  // Load execution history from localStorage
  const loadExecutionHistory = useCallback(() => {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem('syndicate:execution-history');
      if (stored) {
        return JSON.parse(stored) as ExecutionEvent[];
      }
    } catch (error) {
      console.warn('Failed to load execution history:', error);
    }
    
    return [];
  }, []);

  // Save execution event
  const recordEvent = useCallback((event: ExecutionEvent) => {
    if (typeof window === 'undefined') return;

    try {
      const history = loadExecutionHistory();
      const updated = [event, ...history].slice(0, 10); // Keep last 10 events
      localStorage.setItem('syndicate:execution-history', JSON.stringify(updated));
      
      setState(prev => ({
        ...prev,
        lastEvent: event,
        recentEvents: updated,
      }));
    } catch (error) {
      console.warn('Failed to save execution event:', error);
    }
  }, [loadExecutionHistory]);

  // Check if execution should happen now
  const checkExecutionStatus = useCallback(() => {
    if (!autoPurchaseConfig || !permission) {
      setState(prev => ({ ...prev, isMonitoring: false }));
      return;
    }

    const now = Date.now();
    const nextExecution = autoPurchaseConfig.nextExecution || 0;
    const timeUntilNext = nextExecution - now;

    setState(prev => ({
      ...prev,
      nextExecutionIn: Math.max(0, timeUntilNext),
      lastPollTime: now,
    }));

    // Check if execution time has arrived
    if (timeUntilNext <= 0 && !executingRef.current) {
      executingRef.current = true;

      recordEvent({
        timestamp: now,
        type: 'executing',
      });

      console.log('[AutoPurchase] Executing scheduled purchase...', { config: autoPurchaseConfig });

      permittedTicketExecutor.executeScheduledPurchase(autoPurchaseConfig)
        .then((result) => {
          executingRef.current = false;
          if (result.success) {
            console.log('[AutoPurchase] Purchase succeeded:', result.txHash);
            recordEvent({
              timestamp: Date.now(),
              type: 'success',
              txHash: result.txHash,
              nextExecution: result.nextScheduledTime,
            });
          } else {
            console.warn('[AutoPurchase] Purchase failed:', result.error?.message);
            recordEvent({
              timestamp: Date.now(),
              type: 'failed',
              error: result.error?.message,
            });
          }
        })
        .catch((err) => {
          executingRef.current = false;
          console.error('[AutoPurchase] Execution error:', err);
          recordEvent({
            timestamp: Date.now(),
            type: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
    }
  }, [autoPurchaseConfig, permission, recordEvent]);

  // Start monitoring when config is active — with visibility-aware polling
  const shouldMonitor = !!autoPurchaseConfig?.enabled;
  const getPollingInterval = () => {
    if (!autoPurchaseConfig?.nextExecution) return 60000;
    const nextExecution = autoPurchaseConfig.nextExecution;
    const timeUntilNext = nextExecution - Date.now();
    if (timeUntilNext < 5 * 60 * 1000) return 1000;
    if (timeUntilNext < 60 * 60 * 1000) return 10000;
    return 60000;
  };

  useVisibilityPolling({
    callback: checkExecutionStatus,
    intervalMs: getPollingInterval(),
    enabled: shouldMonitor,
    immediate: true,
  });

  // Format next execution time
  const getNextExecutionDisplay = useCallback(() => {
    if (!state.nextExecutionIn) return null;

    if (state.nextExecutionIn <= 0) {
      return 'Executing now';
    }

    const minutes = Math.floor(state.nextExecutionIn / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `In ${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `In ${hours} hour${hours > 1 ? 's' : ''}`;
    }
    if (minutes > 0) {
      return `In ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }

    return 'Any moment';
  }, [state.nextExecutionIn]);

  // Mark execution as successful
  const recordSuccess = useCallback((txHash: string) => {
    recordEvent({
      timestamp: Date.now(),
      type: 'success',
      txHash,
      nextExecution: autoPurchaseConfig?.nextExecution
        ? autoPurchaseConfig.nextExecution + (autoPurchaseConfig.frequency === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)
        : undefined,
    });
  }, [autoPurchaseConfig, recordEvent]);

  // Mark execution as failed
  const recordFailure = useCallback((error: string) => {
    recordEvent({
      timestamp: Date.now(),
      type: 'failed',
      error,
    });
  }, [recordEvent]);

  return {
    // State
    lastEvent: state.lastEvent,
    nextExecutionIn: state.nextExecutionIn,
    nextExecutionDisplay: getNextExecutionDisplay(),
    isMonitoring: state.isMonitoring,
    recentEvents: state.recentEvents,
    lastPollTime: state.lastPollTime,

    // Actions
    recordSuccess,
    recordFailure,
    checkNow: checkExecutionStatus,
  };
}
