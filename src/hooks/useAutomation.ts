/**
 * UNIFIED AUTOMATION HOOK
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Bridges ERC-7715 permissions with unified automation orchestration
 * - MODULAR: Independent of UI, can be used anywhere in app
 * - CLEAN: Single responsibility - manage automation task lifecycle
 * - DRY: Uses AutomationOrchestrator for all strategies
 *
 * Manages:
 * 1. Creating automation tasks from ERC-7715 permissions
 * 2. Monitoring task status and execution
 * 3. Pausing/resuming/canceling tasks
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Address } from 'viem';
import { useERC7715 } from './useERC7715';
import {
  automationOrchestrator,
  type GelatoTaskResponse,
} from '@/services/automation/AutomationOrchestrator';
import type { AdvancedPermissionGrant } from '@/services/automation/erc7715Service';

// =============================================================================
// TYPES
// =============================================================================

export interface AutomationTaskConfig {
  id: string;
  taskId?: string;
  userAddress: Address;
  frequency: 'daily' | 'weekly' | 'monthly';
  amountPerPeriod: bigint;
  nextExecutionTime: number;
  status: 'active' | 'paused' | 'disabled' | 'cancelled';
  createdAt: number;
  lastExecutedAt?: number;
  executionCount: number;
}

export interface UseAutomationState {
  // Task management
  activeTask: AutomationTaskConfig | null;
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

export interface UseAutomationActions {
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

const STORAGE_KEY = 'syndicate_automation_task';

export function useAutomation(
  userAddress?: Address
): UseAutomationState & UseAutomationActions {
  const { isSupported } = useERC7715();

  // Local state
  const [activeTask, setActiveTask] = useState<AutomationTaskConfig | null>(null);
  const [taskStatus, setTaskStatus] = useState<GelatoTaskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load task from storage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const task = JSON.parse(stored) as AutomationTaskConfig;
        setActiveTask(task);

        // Try to load task status if we have a taskId
        if (task.taskId && isSupported) {
          refreshTaskStatus(task.taskId);
        }
      }
    } catch (err) {
      console.error('Failed to load automation task from storage:', err);
    }
  }, [isSupported]);

  // Refresh task status
  const refreshTaskStatus = useCallback(
    async (taskId: string) => {
      try {
        setIsLoading(true);
        const status = await automationOrchestrator.getGelatoTaskStatus(taskId);
        if (status) {
          setTaskStatus(status);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch task status';
        console.error('[Automation] Error refreshing task status:', err);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Create a new automation task
  const createTask = useCallback(
    async (
      permission: AdvancedPermissionGrant,
      frequency: 'daily' | 'weekly' | 'monthly'
    ): Promise<boolean> => {
      if (!isSupported || !userAddress) {
        setError('ERC-7715 not supported or user not connected');
        return false;
      }

      setIsUpdating(true);
      setError(null);

      try {
        console.log('[UseAutomation] Creating task for permission:', {
          permissionId: permission.id,
          frequency,
          amount: permission.limit.toString(),
        });

        // Create task via Orchestrator
        const response = await automationOrchestrator.createGelatoTask(
          userAddress,
          frequency,
          permission.limit,
          '0x0000000000000000000000000000000000000000' // Default referrer
        );

        if (!response) {
          setError('Failed to create automation task');
          return false;
        }

        // Create local task config
        const newTask: AutomationTaskConfig = {
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

        console.log('[UseAutomation] Task created:', newTask.id);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create task';
        setError(msg);
        console.error('[UseAutomation] Error creating task:', err);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [isSupported, userAddress]
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
      const success = await automationOrchestrator.pauseGelatoTask(activeTask.taskId);

      if (success) {
        const updatedTask = { ...activeTask, status: 'paused' as const };
        setActiveTask(updatedTask);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTask));
        console.log('[UseAutomation] Task paused:', activeTask.taskId);
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
  }, [activeTask]);

  // Resume paused task
  const resumeTask = useCallback(async (): Promise<boolean> => {
    if (!activeTask?.taskId) {
      setError('No active task to resume');
      return false;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const success = await automationOrchestrator.resumeGelatoTask(activeTask.taskId);

      if (success) {
        const updatedTask = { ...activeTask, status: 'active' as const };
        setActiveTask(updatedTask);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTask));
        console.log('[UseAutomation] Task resumed:', activeTask.taskId);
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
  }, [activeTask]);

  // Cancel task permanently
  const cancelTask = useCallback(async (): Promise<boolean> => {
    if (!activeTask?.taskId) {
      setError('No active task to cancel');
      return false;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const success = await automationOrchestrator.cancelGelatoTask(activeTask.taskId);

      if (success) {
        setActiveTask(null);
        setTaskStatus(null);
        localStorage.removeItem(STORAGE_KEY);
        console.log('[UseAutomation] Task cancelled:', activeTask.taskId);
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
  }, [activeTask]);

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
