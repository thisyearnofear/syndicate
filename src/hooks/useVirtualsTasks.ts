/**
 * VIRTUALS TASKS HOOK
 *
 * React hook for managing a user's Virtuals ACP agent tasks. Wraps the
 * `/api/virtuals/tasks` endpoints with list/create/update/delete + auto
 * refresh. Used by the VirtualsAgentPanel in the agent hub.
 *
 * Phase 3.5 — user-facing surface for the Virtuals ACP agent.
 *
 * Implemented on React Query: the list is a `useQuery` with a 30s
 * `refetchInterval` (polling pauses when the tab is hidden), and
 * create/update/delete are `useMutation`s with optimistic cache updates.
 */

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

function tasksQueryKey(userAddress: string | null | undefined) {
  return ['virtuals-tasks', userAddress ?? 'none'] as const;
}

async function fetchTasks(userAddress: string): Promise<VirtualsTask[]> {
  const res = await fetch(`/api/virtuals/tasks?userAddress=${userAddress}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  const { tasks: list } = (await res.json()) as { tasks: VirtualsTask[] };
  return list;
}

export function useVirtualsTasks(userAddress: Address | null | undefined): UseVirtualsTasksResult {
  const queryClient = useQueryClient();
  const queryKey = tasksQueryKey(userAddress);

  const {
    data: tasks,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchTasks(userAddress as string),
    enabled: !!userAddress,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  // Optimistic cache writer shared by all three mutations. Keyed off the
  // stable `userAddress` (not the freshly-created queryKey array) so the
  // memoization is not defeated on every render.
  const updateTasksCache = useCallback(
    (updater: (prev: VirtualsTask[]) => VirtualsTask[]) => {
      queryClient.setQueryData<VirtualsTask[]>(tasksQueryKey(userAddress), (prev) => updater(prev ?? []));
    },
    [queryClient, userAddress],
  );

  const createMutation = useMutation({
    mutationFn: async (params: { agentId: string; amount: number; frequency: VirtualsTaskFrequency; recipientEmail: string }) => {
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
      return task;
    },
    onSuccess: (task) => {
      updateTasksCache((prev) => {
        const idx = prev.findIndex((t) => t.id === task.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = task;
          return next;
        }
        return [task, ...prev];
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { id: string; updates: Partial<{ isActive: boolean; status: VirtualsTaskStatus; frequency: VirtualsTaskFrequency; amount: number; recipientEmail: string }> }) => {
      const res = await fetch(`/api/virtuals/tasks/${args.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, ...args.updates }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Update failed (${res.status})`);
      }
      const { task } = (await res.json()) as { task: VirtualsTask };
      return task;
    },
    onSuccess: (task) => {
      updateTasksCache((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/virtuals/tasks/${id}?userAddress=${userAddress}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status})`);
      }
      return id;
    },
    // Mark cancelled in local state (soft delete: row stays in DB).
    onSuccess: (id) => {
      updateTasksCache((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isActive: false, status: 'cancelled' as const } : t)),
      );
    },
  });

  const createTask = useCallback(
    async (params: { agentId: string; amount: number; frequency: VirtualsTaskFrequency; recipientEmail: string }) => {
      if (!userAddress) return null;
      try {
        return await createMutation.mutateAsync(params);
      } catch {
        return null;
      }
    },
    [userAddress, createMutation],
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<{ isActive: boolean; status: VirtualsTaskStatus; frequency: VirtualsTaskFrequency; amount: number; recipientEmail: string }>) => {
      if (!userAddress) return null;
      try {
        return await updateMutation.mutateAsync({ id, updates });
      } catch {
        return null;
      }
    },
    [userAddress, updateMutation],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!userAddress) return false;
      try {
        await deleteMutation.mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    [userAddress, deleteMutation],
  );

  const mutationError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error ?? null;
  const error =
    (queryError instanceof Error ? queryError.message : null) ??
    (mutationError instanceof Error ? mutationError.message : mutationError ? String(mutationError) : null);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    tasks: tasks ?? [],
    isLoading: isFetching,
    error,
    refresh,
    createTask,
    updateTask,
    deleteTask,
  };
}
