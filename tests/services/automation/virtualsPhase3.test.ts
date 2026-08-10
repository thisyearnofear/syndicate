/**
 * REGRESSION TESTS — Virtuals ACP Phase 3 (June 17 2026)
 *
 * Locks in four deliverables from the Virtuals Phase 3 work:
 *
 *   1. `agentRegistryService` exposes a `getVirtualsAgent` method that
 *      surfaces the Syndicate Strategist when env vars are configured
 *      and `syndicate_virtuals_enabled` is set in localStorage. The
 *      `AgentType` union now includes 'virtuals-acp'.
 *
 *   2. `virtualsTaskRepository` is a real Postgres-backed repo with an
 *      in-memory mock for tests. `getTasksDueForExecution` honors both
 *      the kill switch (`is_active`) AND the cron gate
 *      (`next_execution_at <= now()`).
 *
 *   3. `drainVirtualsTasks` calls the orchestrator, persists the
 *      result, reschedules on a min delay (60s on success, 5 min on
 *      failure), and auto-pauses after 3 consecutive failures.
 *
 *   4. `executeVirtualsAgentTask` no longer hardcodes the email
 *      recipient. It honors `task.recipientEmail`, falls back to the
 *      agent's own email, and skips the report if neither is set
 *      (with a warning, not a throw).
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

// NOTE: We do NOT mock @/services/automation/AutomationOrchestrator at the
// file level. drainVirtualsTasks uses jest.spyOn on the singleton, so the
// email-recipient tests below can use the real orchestrator (with
// virtualsService spied on).

// ---------------------------------------------------------------------------
// 1: agentRegistryService — Virtuals agent appears in registry
// ---------------------------------------------------------------------------

describe('AgentRegistryService.getUserAgents — virtuals-acp integration', () => {
    const originalAgentId = process.env.NEXT_PUBLIC_VIRTUALS_AGENT_ID;
    const originalAgentWallet = process.env.NEXT_PUBLIC_VIRTUALS_AGENT_WALLET;

    beforeEach(() => {
        process.env.NEXT_PUBLIC_VIRTUALS_AGENT_ID = '019e9c04-81ea-77d9-88fd-39d58f3b3e4d';
        process.env.NEXT_PUBLIC_VIRTUALS_AGENT_WALLET = '0xdc05f5aed7bedc9e5f37ca9f67d1cc19bf8f136a';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).window = { localStorage: { clear: () => undefined, getItem: () => null, setItem: () => undefined } };
    });

    afterEach(() => {
        if (originalAgentId === undefined) delete process.env.NEXT_PUBLIC_VIRTUALS_AGENT_ID;
        else process.env.NEXT_PUBLIC_VIRTUALS_AGENT_ID = originalAgentId;
        if (originalAgentWallet === undefined) delete process.env.NEXT_PUBLIC_VIRTUALS_AGENT_WALLET;
        else process.env.NEXT_PUBLIC_VIRTUALS_AGENT_WALLET = originalAgentWallet;
    });

    it('returns no virtuals agent when env vars are unset', async () => {
        delete process.env.NEXT_PUBLIC_VIRTUALS_AGENT_ID;
        delete process.env.NEXT_PUBLIC_VIRTUALS_AGENT_WALLET;

        const { AgentRegistryService } = await import('@/services/automation/agentRegistryService');
        const registry = AgentRegistryService.getInstance();
        const agents = await registry.getUserAgents('0x1111111111111111111111111111111111111111');

        expect(agents.some(a => a.type === 'virtuals-acp')).toBe(false);
    });

    it('returns an inactive virtuals agent when env vars are set but localStorage is empty', async () => {
        const { AgentRegistryService } = await import('@/services/automation/agentRegistryService');
        const registry = AgentRegistryService.getInstance();
        const agents = await registry.getUserAgents('0x1111111111111111111111111111111111111111');

        const virtuals = agents.find(a => a.type === 'virtuals-acp');
        expect(virtuals).toBeDefined();
        expect(virtuals?.name).toContain('Syndicate Strategist');
        expect(virtuals?.chainName).toBe('Base');
        expect(virtuals?.isEnabled).toBe(false);
        expect(virtuals?.status).toBe('inactive');
        expect(virtuals?.address).toBe('0xdc05f5aed7bedc9e5f37ca9f67d1cc19bf8f136a');
    });

    it('returns an active virtuals agent when the user has opted in via localStorage', async () => {
        // The registry reads from the jsdom `window.localStorage`, not a
        // custom global. Set the values on the real localStorage so the
        // registry's `localStorage.getItem(...)` call sees them.
        localStorage.setItem('syndicate_virtuals_enabled', 'true');
        localStorage.setItem('syndicate_virtuals_config', JSON.stringify({ frequency: 'daily', activatedAt: 1234 }));

        const { AgentRegistryService } = await import('@/services/automation/agentRegistryService');
        const registry = AgentRegistryService.getInstance();
        const agents = await registry.getUserAgents('0x1111111111111111111111111111111111111111');

        const virtuals = agents.find(a => a.type === 'virtuals-acp');
        expect(virtuals).toBeDefined();
        expect(virtuals?.isEnabled).toBe(true);
        expect(virtuals?.status).toBe('active');
        expect(virtuals?.frequency).toBe('daily');

        // Cleanup
        localStorage.removeItem('syndicate_virtuals_enabled');
        localStorage.removeItem('syndicate_virtuals_config');
    });
});

// ---------------------------------------------------------------------------
// 2: virtualsTaskRepository — CRUD + due-task drain
// ---------------------------------------------------------------------------

describe('MockVirtualsTaskRepository', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MockVirtualsTaskRepository } = require('@/lib/db/schema/virtualsTasks');

    function makeTask(overrides: Partial<{
        id: string; agentId: string; userAddress: string; amount: bigint;
        frequency: 'hourly' | 'daily' | 'weekly' | 'opportunistic';
        nextExecutionAt: number; isActive: boolean; status: 'active' | 'paused' | 'cancelled' | 'failed';
    }> = {}) {
        return {
            id: 't1',
            agentId: 'agent-1',
            userAddress: '0x1111111111111111111111111111111111111111',
            frequency: 'daily',
            amount: 10_000_000n,
            tokenSymbol: 'USDC',
            recipientEmail: 'user@example.com',
            status: 'active' as const,
            executionCount: 0,
            nextExecutionAt: Date.now() - 1000, // due
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ...overrides,
        };
    }

    it('getTasksDueForExecution respects both the kill switch and the cron gate', async () => {
        const repo = new MockVirtualsTaskRepository();
        const now = Date.now();
        await repo.createTask(makeTask({ id: 'a', nextExecutionAt: now - 1000, isActive: true }));     // due, active
        await repo.createTask(makeTask({ id: 'b', nextExecutionAt: now - 1000, isActive: false }));    // due, killed
        await repo.createTask(makeTask({ id: 'c', nextExecutionAt: now + 100_000, isActive: true }));  // future, active
        await repo.createTask(makeTask({ id: 'd', nextExecutionAt: now - 1000, status: 'paused', isActive: true })); // due, paused

        const due = await repo.getTasksDueForExecution(now);
        const ids = due.map((t: { id: string }) => t.id).sort();
        expect(ids).toEqual(['a']);
    });

    it('deactivateAllForAgent flips isActive=false for all tasks of an agent and returns the count', async () => {
        const repo = new MockVirtualsTaskRepository();
        await repo.createTask(makeTask({ id: 'a1', agentId: 'agent-X' }));
        await repo.createTask(makeTask({ id: 'a2', agentId: 'agent-X' }));
        await repo.createTask(makeTask({ id: 'b1', agentId: 'agent-Y' }));

        const flipped = await repo.deactivateAllForAgent('agent-X');
        expect(flipped).toBe(2);
        expect((await repo.getTask('a1'))?.isActive).toBe(false);
        expect((await repo.getTask('a2'))?.isActive).toBe(false);
        expect((await repo.getTask('a2'))?.status).toBe('cancelled');
        // Other agents untouched.
        expect((await repo.getTask('b1'))?.isActive).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 3: drainVirtualsTasks — calls orchestrator, persists result, reschedules
// ---------------------------------------------------------------------------

describe('drainVirtualsTasks', () => {
    let mockExecuteTask: jest.Mock;
    let orchestratorInstance: { executeTask: (t: unknown) => Promise<unknown> };

    beforeEach(() => {
        // Use jest.spyOn on the singleton rather than jest.doMock + resetModules.
        // The resetModules approach broke the email-recipient tests below by
        // binding the orchestrator's `this.virtualsService` to a stale
        // VirtualsService module after the reset.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { AutomationOrchestrator } = require('@/services/automation/AutomationOrchestrator');
        orchestratorInstance = AutomationOrchestrator.getInstance() as { executeTask: (t: unknown) => Promise<unknown> };
        mockExecuteTask = jest.fn();
        jest.spyOn(orchestratorInstance, 'executeTask').mockImplementation(mockExecuteTask);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });


    it('calls the orchestrator for due active tasks and persists success state with a >=60s reschedule', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { MockVirtualsTaskRepository, setVirtualsTaskRepository } = require('@/lib/db/schema/virtualsTasks');
        const repo = new MockVirtualsTaskRepository();
        setVirtualsTaskRepository(repo);

        const task = {
            id: 'task-1',
            agentId: 'agent-1',
            userAddress: '0x1111111111111111111111111111111111111111',
            frequency: 'daily' as const,
            amount: 10_000_000n,
            tokenSymbol: 'USDC',
            recipientEmail: 'user@example.com',
            status: 'active' as const,
            executionCount: 0,
            nextExecutionAt: Date.now() - 1000,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        await repo.createTask(task);

        mockExecuteTask.mockResolvedValue({
            success: true,
            txHash: '0xabc',
            reasoning: 'Venice says: rebalance into Spark.',
        });

        const { drainVirtualsTasks } = await import('@/services/jobs/virtualsJobProcessor');
        const result = await drainVirtualsTasks();

        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);
        expect(mockExecuteTask).toHaveBeenCalledTimes(1);

        // Verify the orchestrator was called with a virtuals-acp task that
        // carries the persisted recipientEmail and amount.
        const arg = mockExecuteTask.mock.calls[0][0];
        expect(arg.strategy).toBe('virtuals-acp');
        expect(arg.recipientEmail).toBe('user@example.com');
        expect(arg.amount).toBe(10_000_000n);

        // Verify persistence: executionCount incremented, lastTxHash set,
        // nextExecutionAt moved forward at least 60s.
        const updated = await repo.getTask('task-1');
        expect(updated?.executionCount).toBe(1);
        expect(updated?.lastTxHash).toBe('0xabc');
        expect(updated?.lastReasoning).toBe('Venice says: rebalance into Spark.');
        expect(updated?.nextExecutionAt).toBeGreaterThanOrEqual(Date.now() + 60_000);
        expect(updated?.status).toBe('active');
    });

    it('skips tasks with isActive=false at the repository level (kill switch prevents them from appearing in the due list)', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { MockVirtualsTaskRepository, setVirtualsTaskRepository } = require('@/lib/db/schema/virtualsTasks');
        const repo = new MockVirtualsTaskRepository();
        setVirtualsTaskRepository(repo);

        await repo.createTask({
            id: 'killed',
            agentId: 'agent-1',
            userAddress: '0x1111111111111111111111111111111111111111',
            frequency: 'daily',
            amount: 10_000_000n,
            tokenSymbol: 'USDC',
            recipientEmail: 'user@example.com',
            status: 'active',
            executionCount: 0,
            nextExecutionAt: Date.now() - 1000,
            isActive: false, // kill switch
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        // The repository's getTasksDueForExecution already filters out
        // !isActive tasks (the primary gate). The processor has a
        // defense-in-depth check too, but it's only reachable if a task
        // flips isActive=false between the repo query and the processor
        // read. Verify the primary gate: the killed task never reaches
        // the processor.
        const due = await repo.getTasksDueForExecution(Date.now());
        expect(due.map((t: { id: string }) => t.id)).not.toContain('killed');

        const { drainVirtualsTasks } = await import('@/services/jobs/virtualsJobProcessor');
        const result = await drainVirtualsTasks();
        expect(result.processed).toBe(0);
        expect(mockExecuteTask).not.toHaveBeenCalled();
    });

    it('auto-pauses a task after 3 consecutive failures (isActive=false)', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { MockVirtualsTaskRepository, setVirtualsTaskRepository } = require('@/lib/db/schema/virtualsTasks');
        const repo = new MockVirtualsTaskRepository();
        setVirtualsTaskRepository(repo);

        // Task with executionCount=2 — one more failure should auto-pause.
        await repo.createTask({
            id: 'doomed',
            agentId: 'agent-1',
            userAddress: '0x1111111111111111111111111111111111111111',
            frequency: 'daily',
            amount: 10_000_000n,
            tokenSymbol: 'USDC',
            recipientEmail: 'user@example.com',
            status: 'active',
            executionCount: 2,
            nextExecutionAt: Date.now() - 1000,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        mockExecuteTask.mockResolvedValue({ success: false, error: 'RPC down' });

        const { drainVirtualsTasks } = await import('@/services/jobs/virtualsJobProcessor');
        await drainVirtualsTasks();

        const updated = await repo.getTask('doomed');
        expect(updated?.isActive).toBe(false);
        expect(updated?.status).toBe('failed');
        expect(updated?.lastError).toBe('RPC down');
    });

    it('returns { processed: 0, errors: 0 } when the queue is empty', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { MockVirtualsTaskRepository, setVirtualsTaskRepository } = require('@/lib/db/schema/virtualsTasks');
        const repo = new MockVirtualsTaskRepository();
        setVirtualsTaskRepository(repo);

        const { drainVirtualsTasks } = await import('@/services/jobs/virtualsJobProcessor');
        const result = await drainVirtualsTasks();

        expect(result).toEqual({ processed: 0, errors: 0, skipped: 0 });
        expect(mockExecuteTask).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 4: executeVirtualsAgentTask no longer hardcodes the email recipient
// ---------------------------------------------------------------------------

describe('executeVirtualsAgentTask — email recipient is no longer hardcoded', () => {
    // The orchestrator's `this.virtualsService` field is set at instance
    // construction time. In Jest's module graph, requiring the same file
    // via different specifiers (e.g. `@/...` vs relative `../../../src/...`)
    // can yield distinct module instances whose static `instance` fields
    // are not shared. To make the test robust, we resolve the spy targets
    // at run time from the orchestrator instance itself, not from any
    // externally-required VirtualsService.
    let sendEmailReport: jest.SpyInstance;
    let getActiveAgent: jest.SpyInstance;

    beforeEach(async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { AutomationOrchestrator } = require('@/services/automation/AutomationOrchestrator');
        const orch = AutomationOrchestrator.getInstance() as unknown as {
            virtualsService: {
                sendEmailReport: (...args: unknown[]) => Promise<boolean>;
                executeAgentTransaction: (...args: unknown[]) => Promise<{ success: boolean; txHash?: string }>;
                getVeniceReasoning: (...args: unknown[]) => Promise<string>;
                getActiveAgent: (...args: unknown[]) => Promise<{ email?: string } | null>;
            };
        };
        // Spy on the SAME instance the orchestrator uses, by going through
        // the orchestrator's own field reference. This avoids any module
        // identity mismatch.
        sendEmailReport = jest.spyOn(orch.virtualsService, 'sendEmailReport').mockResolvedValue(true);
        jest.spyOn(orch.virtualsService, 'executeAgentTransaction')
            .mockResolvedValue({ success: true, txHash: '0xabc' });
        jest.spyOn(orch.virtualsService, 'getVeniceReasoning').mockResolvedValue('reasoning');
        getActiveAgent = jest.spyOn(orch.virtualsService, 'getActiveAgent');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    async function runVirtualsTask(task: Record<string, unknown>): Promise<unknown> {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { AutomationOrchestrator } = require('@/services/automation/AutomationOrchestrator');
        const orch = AutomationOrchestrator.getInstance();
        return (orch as unknown as { executeTask: (t: unknown) => Promise<unknown> }).executeTask(task);
    }

    it('sends the report to task.recipientEmail when set', async () => {
        getActiveAgent.mockResolvedValue({ email: 'agent@world' });

        const result = await runVirtualsTask({
            id: 't1',
            userAddress: '0x1111111111111111111111111111111111111111',
            strategy: 'virtuals-acp',
            status: 'active',
            tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            tokenSymbol: 'USDC',
            // $5 USDC (6 decimals) — at or above one Megapot ticket price,
            // which the orchestrator now requires before executing.
            amount: 5_000_000n,
            frequency: 'daily',
            recipientEmail: 'real-user@example.com',
        });

        expect(sendEmailReport).toHaveBeenCalledTimes(1);
        const call = sendEmailReport.mock.calls[0][0];
        expect(call.to).toBe('real-user@example.com');
        expect((result as { success: boolean }).success).toBe(true);
    });

    it('falls back to the agent email when task.recipientEmail is missing', async () => {
        getActiveAgent.mockResolvedValue({ email: 'agent-fallback@world' });

        await runVirtualsTask({
            id: 't1',
            userAddress: '0x1111111111111111111111111111111111111111',
            strategy: 'virtuals-acp',
            status: 'active',
            tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            tokenSymbol: 'USDC',
            // $5 USDC (6 decimals) — at or above one Megapot ticket price,
            // which the orchestrator now requires before executing.
            amount: 5_000_000n,
            frequency: 'daily',
        });

        expect(sendEmailReport).toHaveBeenCalledTimes(1);
        expect(sendEmailReport.mock.calls[0][0].to).toBe('agent-fallback@world');
    });

    it('skips the report with a warning (not a throw) when neither recipient nor agent email is set', async () => {
        getActiveAgent.mockResolvedValue(null);

        const result = await runVirtualsTask({
            id: 't1',
            userAddress: '0x1111111111111111111111111111111111111111',
            strategy: 'virtuals-acp',
            status: 'active',
            tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            tokenSymbol: 'USDC',
            // $5 USDC (6 decimals) — at or above one Megapot ticket price,
            // which the orchestrator now requires before executing.
            amount: 5_000_000n,
            frequency: 'daily',
        });

        expect(sendEmailReport).not.toHaveBeenCalled();
        expect((result as { success: boolean }).success).toBe(true);
    });
});
