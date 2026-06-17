/**
 * VIRTUALS TASKS HOOK
 *
 * React hook for managing a user's Virtuals ACP agent tasks. Wraps the
 * `/api/virtuals/tasks` endpoints with list/create/update/delete + auto
 * refresh. Used by the VirtualsAgentPanel in the agent hub.
 *
 * Phase 3.5 — user-facing surface for the Virtuals ACP agent.
 */

import { useCallback, useEffect, useState } from 'react';
import { Address } from 'viem';

export type VirtualsTaskFrequency = 'hourly' | 'daily' | 'weekly' | 'opportunistic';
export type VirtualsTaskStatus = 'active' | 'paused' | 'cancelled' | 'failed';

export interface VirtualsTask {
  id: string;
  agentId: string;
  userAddress: string;
  frequency: VirtualsTaskFrequency;
  amount: string; // bigint serialized as string
  tokenSymbol: string;
  recipientEmail: string;
  status: VirtualsTaskStatus;
  executionCount: number;
  lastExecutedAt?: number;
  nextExecutionAt: number;
  lastReasoning?: string;
  lastTxHash?: string;
  lastError?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UseVirtualsTasksResult {
  tasks: VirtualsTask[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTask: (params: {
    agentId: string;
    amount: number;
    frequency: VirtualsTaskFrequency;
    recipientEmail: string;
  }) => Promise<VirtualsTask | null>;
  updateTask: (id: string, updates: Partial<{
    isActive: boolean;
    status: VirtualsTaskStatus;
    frequency: VirtualsTaskFrequency;
    amount: number;
    recipientEmail: string;
  }>) => Promise<VirtualsTask | null>;
  deleteTask: (id: string) => Promise<boolean>;
}

const POLL_INTERVAL_MS = 30_000; // 30s — light polling, the cron is daily

export function useVirtualsTasks(userAddress: Address | null | undefined): UseVirtualsTasksResult {
  const [tasks, setTasks] = useState<VirtualsTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userAddress) {
      setTasks([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/virtuals/tasks?userAddress=${userAddress}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const { tasks: list } = (await res.json()) as { tasks: VirtualsTask[] };
      setTasks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [userAddress]);

  const createTask = useCallback(
    async (params: { agentId: string; amount: number; frequency: VirtualsTaskFrequency; recipientEmail: string }) => {
      if (!userAddress) return null;
      try {
        const res = await fetch('/api/virtuals/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress, ...params }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Create failed (${res.status})`);
        }
        const { task } = (await res.json()) as { task: VirtualsTask };
        // Optimistic update: replace if exists, append if new.
        setTasks(prev => {
          const idx = prev.findIndex(t => t.id === task.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = task;
            return next;
          }
          return [task, ...prev];
        });
        return task;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [userAddress],
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<{
      isActive: boolean;
      status: VirtualsTaskStatus;
      frequency: VirtualsTaskFrequency;
      amount: number;
      recipientEmail: string;
    }>) => {
      if (!userAddress) return null;
      try {
        const res = await fetch(`/api/virtuals/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress, ...updates }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Update failed (${res.status})`);
        }
        const { task } = (await res.json()) as { task: VirtualsTask };
        setTasks(prev => prev.map(t => t.id === id ? task : t));
        return task;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [userAddress],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!userAddress) return false;
      try {
        const res = await fetch(`/api/virtuals/tasks/${id}?userAddress=${userAddress}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Delete failed (${res.status})`);
        }
        // Mark cancelled in local state (soft delete: row stays in DB).
        setTasks(prev => prev.map(t => t.id === id ? { ...t, isActive: false, status: 'cancelled' } : t));
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [userAddress],
  );

  // Initial load + interval polling when a wallet is connected.
  useEffect(() => {
    if (!userAddress) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const id = setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [userAddress, refresh]);

  return { tasks, isLoading, error, refresh, createTask, updateTask, deleteTask };
}
