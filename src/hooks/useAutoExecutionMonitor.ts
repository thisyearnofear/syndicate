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

import { useState, useCallback, useEffect } from 'react';
import { useAdvancedPermissions } from './useAdvancedPermissions';
import type { AutoPurchaseConfig } from '@/domains/wallet/types';

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
    if (timeUntilNext <= 0 && !state.lastEvent?.txHash) {
      // Time to execute - record scheduled event
      recordEvent({
        timestamp: now,
        type: 'scheduled',
        nextExecution: nextExecution + (autoPurchaseConfig.frequency === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000),
      });

      // PERFORMANT: In production, this would trigger API call to backend
      // For now, we just record that it should have executed
      console.log('Auto-purchase should execute now', { config: autoPurchaseConfig });
    }
  }, [autoPurchaseConfig, permission, state.lastEvent?.txHash, recordEvent]);

  // Start monitoring when config is active
  useEffect(() => {
    if (!autoPurchaseConfig?.enabled) {
      setState(prev => ({ ...prev, isMonitoring: false }));
      return;
    }

    setState(prev => ({ ...prev, isMonitoring: true }));

    // Initial check
    checkExecutionStatus();

    // PERFORMANT: Exponential backoff polling
    // Check every minute if execution is > 1 hour away
    // Check every 10 seconds if execution is < 1 hour away
    // Check every second if execution is < 5 minutes away
    const getPollingInterval = () => {
      const nextExecution = autoPurchaseConfig.nextExecution || 0;
      const timeUntilNext = nextExecution - Date.now();

      if (timeUntilNext < 5 * 60 * 1000) return 1000; // 1 second
      if (timeUntilNext < 60 * 60 * 1000) return 10000; // 10 seconds
      return 60000; // 1 minute
    };

    const interval = setInterval(() => {
      checkExecutionStatus();
    }, getPollingInterval());

    return () => clearInterval(interval);
  }, [autoPurchaseConfig?.enabled, autoPurchaseConfig?.nextExecution, checkExecutionStatus]);

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
