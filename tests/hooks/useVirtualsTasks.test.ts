/**
 * HOOK TESTS — useVirtualsTasks
 *
 * Validates the React Query migration's behavioral contract:
 *   - No fetch without a wallet address
 *   - Query key changes on address switch / disconnect
 *   - Create/update/delete mutations with optimistic cache updates
 *   - Error exposure from failed queries and mutations
 *   - Recovery after failed mutations
 *   - Loading semantics (initial vs background refresh)
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { VirtualsTask } from '@/hooks/useVirtualsTasks';
import { useVirtualsTasks } from '@/hooks/useVirtualsTasks';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAddress = { current: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as string | null };

jest.mock('@/hooks/useUnifiedWallet', () => ({
  useUnifiedWallet: () => ({ address: mockAddress.current }),
}));

// Controlled fetch mock
const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
global.fetch = fetchMock as unknown as typeof fetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<VirtualsTask> = {}): VirtualsTask {
  return {
    id: overrides.id ?? 'task-1',
    agentId: 'agent-1',
    userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    frequency: 'daily',
    amount: '10000000',
    tokenSymbol: 'USDC',
    recipientEmail: 'user@example.com',
    status: 'active',
    executionCount: 0,
    nextExecutionAt: Date.now() + 60_000,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function renderTasksHook(address: string | null = mockAddress.current) {
  mockAddress.current = address;
  return renderHook(
    () => useVirtualsTasks(mockAddress.current as `0x${string}` | null),
    { wrapper: createWrapper() },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useVirtualsTasks', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockAddress.current = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  });

  // ─── Query Behavior ─────────────────────────────────────────────────────

  describe('query behavior', () => {
    it('does not fetch when address is null', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ tasks: [] }));
      const { result } = renderTasksHook(null);

      // Give time for any accidental fetch
      await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.tasks).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('fetches tasks when address is provided', async () => {
      const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
      fetchMock.mockResolvedValue(jsonResponse({ tasks }));

      const { result } = renderTasksHook();

      await waitFor(() => expect(result.current.tasks).toHaveLength(2));
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('userAddress=0xAAAA'),
        expect.objectContaining({ cache: 'no-store' }),
      );
    });

    it('returns empty tasks and no error for successful empty response', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ tasks: [] }));
      const { result } = renderTasksHook();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.tasks).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('exposes query error message on fetch failure', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: 'DB timeout' }, 500));
      const { result } = renderTasksHook();

      await waitFor(() => expect(result.current.error).toBe('DB timeout'));
      expect(result.current.tasks).toEqual([]);
    });

    it('exposes generic error when response body is not JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('not JSON')),
      } as unknown as Response);
      const { result } = renderTasksHook();

      await waitFor(() => expect(result.current.error).toContain('502'));
    });
  });

  // ─── Address Changes ────────────────────────────────────────────────────

  describe('address changes', () => {
    it('clears tasks on disconnect (address becomes null)', async () => {
      const tasks = [makeTask()];
      fetchMock.mockResolvedValue(jsonResponse({ tasks }));
      const { result, rerender } = renderTasksHook();

      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      // Disconnect
      mockAddress.current = null;
      rerender();

      await waitFor(() => expect(result.current.tasks).toEqual([]));
    });

    it('refetches on address switch', async () => {
      const tasksA = [makeTask({ id: 'a' })];
      const tasksB = [makeTask({ id: 'b' }), makeTask({ id: 'c' })];

      fetchMock
        .mockResolvedValueOnce(jsonResponse({ tasks: tasksA }))
        .mockResolvedValueOnce(jsonResponse({ tasks: tasksB }));

      const { result, rerender } = renderTasksHook();
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      // Switch address
      mockAddress.current = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
      rerender();

      await waitFor(() => expect(result.current.tasks).toHaveLength(2));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Create Mutation ────────────────────────────────────────────────────

  describe('createTask', () => {
    it('creates a task and updates cache optimistically', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ tasks: [] })) // initial fetch
        .mockResolvedValueOnce(jsonResponse({ task: makeTask({ id: 'new-1' }) })); // create

      const { result } = renderTasksHook();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let created: VirtualsTask | null = null;
      await act(async () => {
        created = await result.current.createTask({
          agentId: 'agent-1',
          amount: 10,
          frequency: 'daily',
          recipientEmail: 'user@example.com',
        });
      });

      expect(created).not.toBeNull();
      expect(created!.id).toBe('new-1');
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));
      expect(result.current.tasks[0].id).toBe('new-1');
    });

    it('returns null and exposes error on create failure', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ tasks: [] }))
        .mockResolvedValueOnce(jsonResponse({ error: 'Duplicate task' }, 409));

      const { result } = renderTasksHook();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let created: VirtualsTask | null = null;
      await act(async () => {
        created = await result.current.createTask({
          agentId: 'agent-1',
          amount: 10,
          frequency: 'daily',
          recipientEmail: 'user@example.com',
        });
      });

      expect(created).toBeNull();
      await waitFor(() => expect(result.current.error).toBe('Duplicate task'));
    });

    it('returns null without fetching when no address', async () => {
      const { result } = renderTasksHook(null);

      let created: VirtualsTask | null = null;
      await act(async () => {
        created = await result.current.createTask({
          agentId: 'agent-1',
          amount: 10,
          frequency: 'daily',
          recipientEmail: 'user@example.com',
        });
      });

      expect(created).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ─── Update Mutation ────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('updates a task in-place in the cache', async () => {
      const task = makeTask({ id: 'task-1', status: 'active' });
      const updated = { ...task, status: 'paused' as const, isActive: false };
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ tasks: [task] }))
        .mockResolvedValueOnce(jsonResponse({ task: updated }));

      const { result } = renderTasksHook();
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      await act(async () => {
        await result.current.updateTask('task-1', { isActive: false });
      });

      await waitFor(() => expect(result.current.tasks[0].status).toBe('paused'));
      expect(result.current.tasks[0].isActive).toBe(false);
    });

    it('returns null and exposes error on update failure', async () => {
      const task = makeTask();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ tasks: [task] }))
        .mockResolvedValueOnce(jsonResponse({ error: 'Not found' }, 404));

      const { result } = renderTasksHook();
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      let updated: VirtualsTask | null = null;
      await act(async () => {
        updated = await result.current.updateTask('task-1', { frequency: 'weekly' });
      });

      expect(updated).toBeNull();
      await waitFor(() => expect(result.current.error).toBe('Not found'));
    });
  });

  // ─── Delete Mutation ────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('marks the task as cancelled in cache (soft delete)', async () => {
      const task = makeTask({ id: 'task-1' });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ tasks: [task] }))
        .mockResolvedValueOnce(jsonResponse({})); // DELETE 200

      const { result } = renderTasksHook();
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      let success = false;
      await act(async () => {
        success = await result.current.deleteTask('task-1');
      });

      expect(success).toBe(true);
      await waitFor(() => expect(result.current.tasks[0].isActive).toBe(false));
      expect(result.current.tasks[0].status).toBe('cancelled');
    });

    it('returns false on delete failure', async () => {
      const task = makeTask({ id: 'task-1' });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ tasks: [task] }))
        .mockResolvedValueOnce(jsonResponse({ error: 'Server error' }, 500));

      const { result } = renderTasksHook();
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      let success = true;
      await act(async () => {
        success = await result.current.deleteTask('task-1');
      });

      expect(success).toBe(false);
      await waitFor(() => expect(result.current.error).toBe('Server error'));
    });

    it('returns false without fetching when no address', async () => {
      const { result } = renderTasksHook(null);

      let success = true;
      await act(async () => {
        success = await result.current.deleteTask('task-1');
      });

      expect(success).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ─── Recovery ───────────────────────────────────────────────────────────

  describe('error recovery', () => {
    it('clears error on next successful fetch via refresh()', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: 'DB timeout' }, 500))
        .mockResolvedValueOnce(jsonResponse({ tasks: [makeTask()] }));

      const { result } = renderTasksHook();
      await waitFor(() => expect(result.current.error).toBe('DB timeout'));

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => expect(result.current.error).toBeNull());
      expect(result.current.tasks).toHaveLength(1);
    });
  });

  // ─── Loading Semantics ──────────────────────────────────────────────────

  describe('loading semantics', () => {
    it('isInitialLoading is true only when no data exists yet', async () => {
      // Slow initial fetch
      let resolveInitial!: (v: Response) => void;
      fetchMock.mockReturnValueOnce(new Promise((r) => { resolveInitial = r; }));

      const { result } = renderTasksHook();

      // Before data arrives, isInitialLoading should be true
      expect(result.current.isInitialLoading).toBe(true);
      expect(result.current.isRefreshing).toBe(false);

      await act(async () => {
        resolveInitial(jsonResponse({ tasks: [makeTask()] }));
      });

      await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
      expect(result.current.tasks).toHaveLength(1);
    });

    it('isRefreshing is true during a background refetch after initial data loads', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ tasks: [makeTask()] }));
      const { result } = renderTasksHook();
      await waitFor(() => expect(result.current.tasks).toHaveLength(1));

      // Trigger a background refetch that is slow
      let resolveRefresh!: (v: Response) => void;
      fetchMock.mockReturnValueOnce(new Promise((r) => { resolveRefresh = r; }));

      act(() => { void result.current.refresh(); });

      await waitFor(() => expect(result.current.isRefreshing).toBe(true));
      expect(result.current.isInitialLoading).toBe(false);

      await act(async () => {
        resolveRefresh(jsonResponse({ tasks: [makeTask()] }));
      });

      await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    });
  });
});
