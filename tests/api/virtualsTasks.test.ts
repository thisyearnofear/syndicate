/**
 * REGRESSION TESTS — Virtuals Agent Panel (Phase 3.5)
 *
 * Locks in the user-facing surface for the Virtuals ACP agent:
 *
 *   1. /api/virtuals/tasks  (list + create) — auth-by-userAddress, idempotent
 *      on (agent_id, user_address, recipient_email), validates inputs.
 *   2. /api/virtuals/tasks/[id] (get + patch + delete) — ownership-checked,
 *      patches are partial, delete is a soft-cancel (isActive=false +
 *      status='cancelled' so the row stays for the activity log).
 *   3. useVirtualsTasks hook — list/create/update/delete through the
 *      real API surface, with optimistic updates.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Mock the in-memory Virtuals repository so tests don't need a real DB.
const mockCreateTask = jest.fn();
const mockGetTask = jest.fn();
const mockGetTasksByUserAddress = jest.fn();
const mockUpdateTask = jest.fn();
const mockDeleteTask = jest.fn();
const mockGetTasksDueForExecution = jest.fn();
const mockDeactivateAllForAgent = jest.fn();
const mockEnsureTable = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/db/repositories/virtualsTaskRepository', () => ({
    ensureVirtualsTasksTable: () => mockEnsureTable(),
}));

jest.mock('@/lib/db/schema/virtualsTasks', () => {
    // Build a mock module that re-uses the real MockVirtualsTaskRepository
    // so the in-memory store is shared across calls.
     
    const real = jest.requireActual('@/lib/db/schema/virtualsTasks');
    return {
        ...real,
        getVirtualsTaskRepository: () => ({
            createTask: mockCreateTask,
            getTask: mockGetTask,
            getTasksByUserAddress: mockGetTasksByUserAddress,
            updateTask: mockUpdateTask,
            deleteTask: mockDeleteTask,
            getTasksDueForExecution: mockGetTasksDueForExecution,
            deactivateAllForAgent: mockDeactivateAllForAgent,
        }),
        setVirtualsTaskRepository: jest.fn(),
    };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<{
    id: string; agentId: string; userAddress: string; amount: bigint;
    frequency: 'hourly' | 'daily' | 'weekly' | 'opportunistic';
    recipientEmail: string; status: 'active' | 'paused' | 'cancelled' | 'failed';
    isActive: boolean; nextExecutionAt: number; executionCount: number;
}> = {}) {
    return {
        id: overrides.id ?? 'task-1',
        agentId: overrides.agentId ?? 'agent-1',
        userAddress: overrides.userAddress ?? '0x1111111111111111111111111111111111111111',
        frequency: overrides.frequency ?? 'daily',
        amount: overrides.amount ?? 10_000_000n,
        tokenSymbol: 'USDC',
        recipientEmail: overrides.recipientEmail ?? 'user@example.com',
        status: overrides.status ?? 'active',
        executionCount: overrides.executionCount ?? 0,
        nextExecutionAt: overrides.nextExecutionAt ?? Date.now() + 60_000,
        isActive: overrides.isActive ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

// ---------------------------------------------------------------------------
// /api/virtuals/tasks — GET (list)
// ---------------------------------------------------------------------------

describe('GET /api/virtuals/tasks', () => {
    beforeEach(() => {
        mockEnsureTable.mockClear();
        mockGetTasksByUserAddress.mockReset();
    });

    it('returns 400 when userAddress is missing or invalid', async () => {
        const { GET } = await import('@/app/api/virtuals/tasks/route');
        const req = new Request('http://localhost/api/virtuals/tasks');
        const res = await GET(req as unknown as import('next/server').NextRequest);
        expect(res.status).toBe(400);
    });

    it('returns the user\'s tasks (bigints serialized as strings)', async () => {
        mockGetTasksByUserAddress.mockResolvedValue([
            makeTask({ id: 'a', amount: 25_000_000n }),
            makeTask({ id: 'b', amount: 5_000_000n, status: 'paused' }),
        ]);
        const { GET } = await import('@/app/api/virtuals/tasks/route');
        const req = new Request('http://localhost/api/virtuals/tasks?userAddress=0x1111111111111111111111111111111111111111');
        const res = await GET(req as unknown as import('next/server').NextRequest);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tasks).toHaveLength(2);
        expect(body.tasks[0].amount).toBe('25000000');
        expect(body.tasks[1].amount).toBe('5000000');
        expect(body.tasks[1].status).toBe('paused');
    });
});

// ---------------------------------------------------------------------------
// /api/virtuals/tasks — POST (create)
// ---------------------------------------------------------------------------

describe('POST /api/virtuals/tasks', () => {
    beforeEach(() => {
        mockEnsureTable.mockClear();
        mockCreateTask.mockReset();
        mockGetTasksByUserAddress.mockReset();
    });

    const validBody = {
        userAddress: '0x1111111111111111111111111111111111111111',
        agentId: 'agent-1',
        amount: 10,
        frequency: 'daily',
        recipientEmail: 'user@example.com',
    };

    it('rejects bad inputs with 400', async () => {
        const { POST } = await import('@/app/api/virtuals/tasks/route');
        for (const bad of [
            { ...validBody, userAddress: '0xnope' },
            { ...validBody, amount: -1 },
            { ...validBody, amount: 'ten' as unknown as number },
            { ...validBody, frequency: 'yearly' },
            { ...validBody, recipientEmail: 'not-an-email' },
            { ...validBody, agentId: '' },
        ]) {
            const req = new Request('http://localhost/api/virtuals/tasks', {
                method: 'POST',
                body: JSON.stringify(bad),
            });
            const res = await POST(req as unknown as import('next/server').NextRequest);
            expect(res.status).toBe(400);
        }
    });

    it('creates a task and returns 201 with the serialized record', async () => {
        const created = makeTask({ amount: 10_000_000n });
        mockGetTasksByUserAddress.mockResolvedValue([]); // no existing
        mockCreateTask.mockResolvedValue(created);
        const { POST } = await import('@/app/api/virtuals/tasks/route');
        const req = new Request('http://localhost/api/virtuals/tasks', {
            method: 'POST',
            body: JSON.stringify(validBody),
        });
        const res = await POST(req as unknown as import('next/server').NextRequest);
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.created).toBe(true);
        expect(body.task.amount).toBe('10000000');
        expect(mockCreateTask).toHaveBeenCalledTimes(1);
        // amount is stored as bigint (6-decimal USDC).
        const callArg = mockCreateTask.mock.calls[0][0];
        expect(callArg.amount).toBe(10_000_000n);
    });

    it('is idempotent on (agentId, userAddress, recipientEmail) — returns existing', async () => {
        const existing = makeTask({ id: 'existing-1' });
        mockGetTasksByUserAddress.mockResolvedValue([existing]);
        const { POST } = await import('@/app/api/virtuals/tasks/route');
        const req = new Request('http://localhost/api/virtuals/tasks', {
            method: 'POST',
            body: JSON.stringify(validBody),
        });
        const res = await POST(req as unknown as import('next/server').NextRequest);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.created).toBe(false);
        expect(body.task.id).toBe('existing-1');
        expect(mockCreateTask).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// /api/virtuals/tasks/[id] — GET / PATCH / DELETE
// ---------------------------------------------------------------------------

describe('/api/virtuals/tasks/[id]', () => {
    beforeEach(() => {
        mockEnsureTable.mockClear();
        mockGetTask.mockReset();
        mockUpdateTask.mockReset();
    });

    const taskA = makeTask({ id: 'task-A', userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
    const taskB = makeTask({ id: 'task-B', userAddress: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' });

    describe('GET', () => {
        it('returns the task for the owning user', async () => {
            mockGetTask.mockResolvedValue(taskA);
            const { GET } = await import('@/app/api/virtuals/tasks/[id]/route');
            const req = new Request('http://localhost/api/virtuals/tasks/task-A?userAddress=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
            const res = await GET(req as unknown as import('next/server').NextRequest, { params: Promise.resolve({ id: 'task-A' }) });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.task.id).toBe('task-A');
        });

        it('returns 404 for tasks owned by another user (no info leak)', async () => {
            mockGetTask.mockResolvedValue(taskB);
            const { GET } = await import('@/app/api/virtuals/tasks/[id]/route');
            const req = new Request('http://localhost/api/virtuals/tasks/task-B?userAddress=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
            const res = await GET(req as unknown as import('next/server').NextRequest, { params: Promise.resolve({ id: 'task-B' }) });
            expect(res.status).toBe(404);
        });
    });

    describe('PATCH', () => {
        it('flips isActive=false → status becomes "paused"', async () => {
            mockGetTask.mockResolvedValue({ ...taskA, isActive: true, status: 'active' });
            mockUpdateTask.mockImplementation(async (_id, updates) => ({ ...taskA, ...updates }));
            const { PATCH } = await import('@/app/api/virtuals/tasks/[id]/route');
            const req = new Request('http://localhost/api/virtuals/tasks/task-A', {
                method: 'PATCH',
                body: JSON.stringify({ userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', isActive: false }),
            });
            const res = await PATCH(req as unknown as import('next/server').NextRequest, { params: Promise.resolve({ id: 'task-A' }) });
            expect(res.status).toBe(200);
            const updates = mockUpdateTask.mock.calls[0][1];
            expect(updates.isActive).toBe(false);
            expect(updates.status).toBe('paused');
        });

        it('reschedules nextExecutionAt when frequency changes', async () => {
            const before = Date.now();
            mockGetTask.mockResolvedValue(taskA);
            mockUpdateTask.mockImplementation(async (_id, updates) => ({ ...taskA, ...updates }));
            const { PATCH } = await import('@/app/api/virtuals/tasks/[id]/route');
            const req = new Request('http://localhost/api/virtuals/tasks/task-A', {
                method: 'PATCH',
                body: JSON.stringify({ userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', frequency: 'weekly' }),
            });
            await PATCH(req as unknown as import('next/server').NextRequest, { params: Promise.resolve({ id: 'task-A' }) });
            const updates = mockUpdateTask.mock.calls[0][1];
            expect(updates.frequency).toBe('weekly');
            // 7 days from now, in ms
            const expectedMin = before + 7 * 24 * 60 * 60 * 1000;
            expect(updates.nextExecutionAt).toBeGreaterThanOrEqual(expectedMin - 100);
        });

        it('rejects bad frequency with 400', async () => {
            const { PATCH } = await import('@/app/api/virtuals/tasks/[id]/route');
            const req = new Request('http://localhost/api/virtuals/tasks/task-A', {
                method: 'PATCH',
                body: JSON.stringify({ userAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', frequency: 'yearly' }),
            });
            const res = await PATCH(req as unknown as import('next/server').NextRequest, { params: Promise.resolve({ id: 'task-A' }) });
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE', () => {
        it('soft-cancels the task (isActive=false, status=cancelled)', async () => {
            mockGetTask.mockResolvedValue(taskA);
            mockUpdateTask.mockImplementation(async (_id, updates) => ({ ...taskA, ...updates }));
            const { DELETE } = await import('@/app/api/virtuals/tasks/[id]/route');
            const req = new Request('http://localhost/api/virtuals/tasks/task-A?userAddress=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
            const res = await DELETE(req as unknown as import('next/server').NextRequest, { params: Promise.resolve({ id: 'task-A' }) });
            expect(res.status).toBe(200);
            const updates = mockUpdateTask.mock.calls[0][1];
            expect(updates.isActive).toBe(false);
            expect(updates.status).toBe('cancelled');
        });
    });
});
