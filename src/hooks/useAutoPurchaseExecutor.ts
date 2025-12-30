/**
 * AUTO-PURCHASE EXECUTOR HOOK
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enables automated ticket purchasing with ERC-7715 permissions
 * - DRY: Single source of truth for auto-purchase execution logic
 * - CLEAN: Monitors permissions and executes purchases when conditions are met
 * - MODULAR: Can be used anywhere in the app to trigger auto-purchases
 * 
 * Features:
 * - Checks for active ERC-7715 permissions
 * - Schedules next purchase based on frequency (weekly/monthly)
 * - Executes delegated purchases without user signature
 * - Stores execution history in localStorage
 * - Handles errors gracefully
 */

import { useState, useCallback, useEffect } from 'react';
import { useERC7715 } from './useERC7715';
import { useSimplePurchase } from './useSimplePurchase';
import type { AdvancedPermissionGrant } from '@/services/erc7715Service';

export interface AutoPurchaseExecution {
  timestamp: number;
  permissionId: string;
  ticketCount: number;
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface UseAutoPurchaseExecutorState {
  isEnabled: boolean;
  nextExecution?: number;
  lastExecution?: AutoPurchaseExecution;
  executionHistory: AutoPurchaseExecution[];
  isExecuting: boolean;
  error: string | null;
}

export interface UseAutoPurchaseExecutorActions {
  executeNow: (permissionId: string, ticketCount?: number) => Promise<boolean>;
  clearHistory: () => void;
  clearError: () => void;
}

const STORAGE_KEY = 'syndicate_autopurchase_executions';
const CONFIG_KEY = 'syndicate_autopurchase_config';

export interface AutoPurchaseConfig {
  permissionId: string;
  frequency: 'weekly' | 'monthly';
  ticketCount: number;
  nextExecutionTime: number;
  lastExecutionTime?: number;
}

export function useAutoPurchaseExecutor(
  enabled: boolean = false
): UseAutoPurchaseExecutorState & UseAutoPurchaseExecutorActions {
  const { permissions, isSupported } = useERC7715();
  const { purchase } = useSimplePurchase();
  
  const [state, setState] = useState<UseAutoPurchaseExecutorState>({
    isEnabled: false,
    executionHistory: [],
    isExecuting: false,
    error: null,
  });

  // Load execution history from localStorage
  useEffect(() => {
    const loadHistory = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const history = JSON.parse(stored) as AutoPurchaseExecution[];
          setState(prev => ({
            ...prev,
            executionHistory: history,
            lastExecution: history[history.length - 1],
          }));
        }
      } catch (error) {
        console.error('Failed to load auto-purchase history:', error);
      }
    };

    loadHistory();
  }, []);

  // Load and check auto-purchase config
  useEffect(() => {
    const checkAndExecute = async () => {
      if (!enabled || !isSupported || permissions.length === 0) {
        setState(prev => ({ ...prev, isEnabled: false }));
        return;
      }

      try {
        const stored = localStorage.getItem(CONFIG_KEY);
        if (!stored) {
          setState(prev => ({ ...prev, isEnabled: false }));
          return;
        }

        const config = JSON.parse(stored) as AutoPurchaseConfig;
        const now = Date.now();

        // Set enabled state
        setState(prev => ({
          ...prev,
          isEnabled: true,
          nextExecution: config.nextExecutionTime,
        }));

        // Check if it's time to execute
        if (now >= config.nextExecutionTime) {
          await executeNow(config.permissionId, config.ticketCount);
        }
      } catch (error) {
        console.error('Auto-purchase check failed:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Check failed',
        }));
      }
    };

    checkAndExecute();
  }, [enabled, isSupported, permissions]);

  // Execute auto-purchase
  const executeNow = useCallback(
    async (permissionId: string, ticketCount: number = 5): Promise<boolean> => {
      if (!isSupported) {
        setState(prev => ({
          ...prev,
          error: 'ERC-7715 not supported',
        }));
        return false;
      }

      const permission = permissions.find(p => p.id === permissionId);
      if (!permission) {
        setState(prev => ({
          ...prev,
          error: 'Permission not found',
        }));
        return false;
      }

      setState(prev => ({
        ...prev,
        isExecuting: true,
        error: null,
      }));

      try {
        // ENHANCEMENT: Execute purchase with permission delegation
        const result = await purchase(
          {
            chain: 'base',
            userAddress: permission.target, // Use permission target as buyer
            ticketCount,
          },
          permissionId
        );

        if (!result.success) {
          throw new Error(result.error?.message || 'Purchase failed');
        }

        // Record execution
        const execution: AutoPurchaseExecution = {
          timestamp: Date.now(),
          permissionId,
          ticketCount,
          success: true,
          txHash: result.txHash,
        };

        // Save to history
        const history = state.executionHistory;
        history.push(execution);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

        // Calculate next execution time
        const stored = localStorage.getItem(CONFIG_KEY);
        if (stored) {
          const config = JSON.parse(stored) as AutoPurchaseConfig;
          const daysToAdd = config.frequency === 'weekly' ? 7 : 30;
          const nextTime = Date.now() + daysToAdd * 24 * 60 * 60 * 1000;
          
          config.nextExecutionTime = nextTime;
          config.lastExecutionTime = Date.now();
          localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

          setState(prev => ({
            ...prev,
            isExecuting: false,
            lastExecution: execution,
            executionHistory: history,
            nextExecution: nextTime,
          }));
        }

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Execution failed';
        
        // Record failed execution
        const execution: AutoPurchaseExecution = {
          timestamp: Date.now(),
          permissionId,
          ticketCount,
          success: false,
          error: errorMessage,
        };

        const history = state.executionHistory;
        history.push(execution);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

        setState(prev => ({
          ...prev,
          isExecuting: false,
          error: errorMessage,
          lastExecution: execution,
          executionHistory: history,
        }));

        return false;
      }
    },
    [isSupported, permissions, purchase, state.executionHistory]
  );

  // Clear history
  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(prev => ({
      ...prev,
      executionHistory: [],
      lastExecution: undefined,
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    ...state,
    executeNow,
    clearHistory,
    clearError,
  };
}
