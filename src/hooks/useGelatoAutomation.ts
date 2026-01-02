/**
 * USE GELATO AUTOMATION HOOK
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Bridges ERC-7715 permissions with Gelato task management
 * - MODULAR: Independent of UI, can be used anywhere in app
 * - CLEAN: Single responsibility - manage Gelato task lifecycle
 * - DRY: Uses unified ERC-7715 service for permissions
 *
 * Manages:
 * 1. Creating Gelato tasks from ERC-7715 permissions
 * 2. Monitoring task status and execution
 * 3. Pausing/resuming/canceling tasks
 * 4. Tracking execution history
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Address } from 'viem';
import { useERC7715 } from './useERC7715';
import {
  getGelatoService,
  type GelatoTaskResponse,
  type GelatoTaskConfig,
} from '@/services/automation/gelatoService';
import type { AdvancedPermissionGrant } from '@/services/erc7715Service';

// =============================================================================
// TYPES
// =============================================================================

export interface UseGelatoAutomationState {
  // Task management
  activeTask: GelatoTaskConfig | null;
  taskStatus: GelatoTaskResponse | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;

  // Monitoring
  lastExecutionTime?: number;
  executionCount: number;
  nextExecutionTime?: number;
  isHealthy: boolean;
}

export interface UseGelatoAutomationActions {
  // Task lifecycle
  createTask: (
    permission: AdvancedPermissionGrant,
    frequency: 'daily' | 'weekly' | 'monthly'
  ) => Promise<boolean>;
  pauseTask: () => Promise<boolean>;
  resumeTask: () => Promise<boolean>;
  cancelTask: () => Promise<boolean>;

  // Status management
  refreshStatus: () => Promise<void>;
  clearError: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

const STORAGE_KEY = 'syndicate_gelato_task';

export function useGelatoAutomation(
  userAddress?: Address
): UseGelatoAutomationState & UseGelatoAutomationActions {
  const { permissions, isSupported } = useERC7715();

  // Local state
  const [activeTask, setActiveTask] = useState<GelatoTaskConfig | null>(null);
  const [taskStatus, setTaskStatus] = useState<GelatoTaskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionCount, setExecutionCount] = useState(0);

  // Load task from storage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const task = JSON.parse(stored) as GelatoTaskConfig;
        setActiveTask(task);

        // Try to load task status from Gelato if we have a taskId
        if (task.taskId && isSupported) {
          refreshTaskStatus(task.taskId);
        }
      }
    } catch (err) {
      console.error('Failed to load Gelato task from storage:', err);
    }
  }, [isSupported]);

  // Get service instance
  const gelatoService = getGelatoService();

  // Refresh task status from Gelato
  const refreshTaskStatus = useCallback(
    async (taskId: string) => {
      if (!gelatoService) return;

      try {
        setIsLoading(true);
        const status = await gelatoService.getTaskStatus(taskId);
        if (status) {
          setTaskStatus(status);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch task status';
        console.error('[Gelato] Error refreshing task status:', err);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [gelatoService]
  );

  // Create a new Gelato task
  const createTask = useCallback(
    async (
      permission: AdvancedPermissionGrant,
      frequency: 'daily' | 'weekly' | 'monthly'
    ): Promise<boolean> => {
      if (!isSupported || !userAddress) {
        setError('ERC-7715 not supported or user not connected');
        return false;
      }

      if (!gelatoService) {
        setError('Gelato service not initialized');
        return false;
      }

      setIsUpdating(true);
      setError(null);

      try {
        console.log('[UseGelatoAutomation] Creating task for permission:', {
          permissionId: permission.id,
          frequency,
          amount: permission.limit.toString(),
        });

        // Create task in Gelato
        const response = await gelatoService.createAutoPurchaseTask(
          userAddress,
          frequency,
          permission.limit,
          '0x0000000000000000000000000000000000000000' // Default referrer
        );

        if (!response) {
          setError('Failed to create Gelato task');
          return false;
        }

        // Create local task config
        const newTask: GelatoTaskConfig = {
          id: `task_${Date.now()}`,
          taskId: response.taskId,
          userAddress,
          frequency,
          amountPerPeriod: permission.limit,
          nextExecutionTime: response.nextExecTime,
          status: 'active',
          createdAt: Math.floor(Date.now() / 1000),
          executionCount: 0,
        };

        // Save to localStorage and state
        setActiveTask(newTask);
        setTaskStatus(response);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newTask));

        console.log('[UseGelatoAutomation] Task created:', newTask.id);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create task';
        setError(msg);
        console.error('[UseGelatoAutomation] Error creating task:', err);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [isSupported, userAddress, gelatoService]
  );

  // Pause current task
  const pauseTask = useCallback(async (): Promise<boolean> => {
    if (!activeTask?.taskId) {
      setError('No active task to pause');
      return false;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const success = await gelatoService.pauseTask(activeTask.taskId);

      if (success) {
        const updatedTask = { ...activeTask, status: 'paused' as const };
        setActiveTask(updatedTask);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTask));
        console.log('[UseGelatoAutomation] Task paused:', activeTask.taskId);
      } else {
        setError('Failed to pause task');
      }

      return success;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to pause task';
      setError(msg);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [activeTask, gelatoService]);

  // Resume paused task
  const resumeTask = useCallback(async (): Promise<boolean> => {
    if (!activeTask?.taskId) {
      setError('No active task to resume');
      return false;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const success = await gelatoService.resumeTask(activeTask.taskId);

      if (success) {
        const updatedTask = { ...activeTask, status: 'active' as const };
        setActiveTask(updatedTask);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTask));
        console.log('[UseGelatoAutomation] Task resumed:', activeTask.taskId);
      } else {
        setError('Failed to resume task');
      }

      return success;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resume task';
      setError(msg);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [activeTask, gelatoService]);

  // Cancel task permanently
  const cancelTask = useCallback(async (): Promise<boolean> => {
    if (!activeTask?.taskId) {
      setError('No active task to cancel');
      return false;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const success = await gelatoService.cancelTask(activeTask.taskId);

      if (success) {
        setActiveTask(null);
        setTaskStatus(null);
        localStorage.removeItem(STORAGE_KEY);
        console.log('[UseGelatoAutomation] Task cancelled:', activeTask.taskId);
      } else {
        setError('Failed to cancel task');
      }

      return success;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel task';
      setError(msg);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [activeTask, gelatoService]);

  // Refresh status
  const refreshStatus = useCallback(async () => {
    if (activeTask?.taskId) {
      await refreshTaskStatus(activeTask.taskId);
    }
  }, [activeTask, refreshTaskStatus]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Calculate health status
  const isHealthy = useMemo(() => {
    if (!activeTask || activeTask.status !== 'active') return false;
    if (!taskStatus) return false;
    if (taskStatus.status !== 'active') return false;
    return true;
  }, [activeTask, taskStatus]);

  return useMemo(
    () => ({
      // State
      activeTask,
      taskStatus,
      isLoading,
      isUpdating,
      error,
      lastExecutionTime: activeTask?.lastExecutedAt,
      executionCount: activeTask?.executionCount ?? 0,
      nextExecutionTime: activeTask?.nextExecutionTime,
      isHealthy,

      // Actions
      createTask,
      pauseTask,
      resumeTask,
      cancelTask,
      refreshStatus,
      clearError,
    }),
    [
      activeTask,
      taskStatus,
      isLoading,
      isUpdating,
      error,
      executionCount,
      isHealthy,
      createTask,
      pauseTask,
      resumeTask,
      cancelTask,
      refreshStatus,
      clearError,
    ]
  );
}
