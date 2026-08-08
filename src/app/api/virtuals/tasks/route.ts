/**
 * Virtuals Tasks API
 *
 * GET  /api/virtuals/tasks?userAddress=0x...   — list a user's persisted tasks
 * POST /api/virtuals/tasks                     — create a new task
 *
 * Phase 3.5 — user-facing surface for the Virtuals ACP agent.
 *
 * Auth: routes accept `userAddress` from the request body / query and trust
 * it. The existing automation routes (e.g. /api/virtuals/email) follow the
 * same pattern. A future hardening pass can add signed-message verification.
 *
 * Idempotency: createTask upserts on (agent_id, user_address, recipient_email)
 * — creating a second task for the same user with the same email returns the
 * existing record instead of creating a duplicate. This matches the typical
 * UX where a user has "one agent" per (user, recipient_email) combination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureVirtualsTasksTable } from '@/lib/db/repositories/virtualsTaskRepository';
import {
  getVirtualsTaskRepository,
  type VirtualsTaskRecord,
  type VirtualsTaskFrequency,
} from '@/lib/db/schema/virtualsTasks';
import { logger } from '@/lib/logger';
import {
  runMutationGuards,
  validateAmountBounds,
  isTaskCapReached,
  auditLog,
} from './guards';

const VALID_FREQUENCIES: ReadonlySet<VirtualsTaskFrequency> = new Set([
  'hourly', 'daily', 'weekly', 'opportunistic',
]);

function isValidAddress(addr: unknown): addr is `0x${string}` {
  return typeof addr === 'string'
    && addr.startsWith('0x')
    && addr.length === 42
    && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------------------------------------------------------------------------
// GET /api/virtuals/tasks?userAddress=0x...
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    await ensureVirtualsTasksTable();

    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    if (!isValidAddress(userAddress)) {
      return NextResponse.json(
        { error: 'userAddress query param is required and must be a valid 0x-prefixed EVM address' },
        { status: 400 },
      );
    }

    const repo = getVirtualsTaskRepository();
    const tasks = await repo.getTasksByUserAddress(userAddress);

    // Serialize bigints as strings so JSON.stringify doesn't blow up.
    return NextResponse.json({
      tasks: tasks.map(serializeTask),
    });
  } catch (error) {
    logger.error('[VirtualsTasks GET] failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/virtuals/tasks
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    await ensureVirtualsTasksTable();

    const body = await req.json().catch(() => ({}));
    const { userAddress, agentId, amount, frequency, recipientEmail } = body ?? {};

    if (!isValidAddress(userAddress)) {
      return NextResponse.json({ error: 'userAddress is required (0x-prefixed EVM address)' }, { status: 400 });
    }
    if (typeof agentId !== 'string' || agentId.length === 0) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number (human-readable USDC)' }, { status: 400 });
    }
    if (!VALID_FREQUENCIES.has(frequency)) {
      return NextResponse.json(
        { error: `frequency must be one of: ${Array.from(VALID_FREQUENCIES).join(', ')}` },
        { status: 400 },
      );
    }
    if (!isValidEmail(recipientEmail)) {
      return NextResponse.json({ error: 'recipientEmail must be a valid email address' }, { status: 400 });
    }

    // ── Server-side guards ──────────────────────────────────────────────────
    const guard = runMutationGuards({
      userAddress,
      operation: 'create',
      idempotencyKey: `create:${userAddress}:${agentId}:${recipientEmail}`,
    });
    if (!guard.allowed) return guard.response!;

    const amountError = validateAmountBounds(amount);
    if (amountError) {
      return NextResponse.json({ error: amountError }, { status: 400 });
    }

    const repo = getVirtualsTaskRepository();

    // Idempotency: if a task already exists for this (agentId, userAddress,
    // recipientEmail) combo, return it instead of creating a duplicate.
    const existing = (await repo.getTasksByUserAddress(userAddress))
      .find(t => t.agentId === agentId && t.recipientEmail === recipientEmail);
    if (existing) {
      return NextResponse.json({ task: serializeTask(existing), created: false });
    }

    // Task cap enforcement
    const allUserTasks = await repo.getTasksByUserAddress(userAddress);
    if (isTaskCapReached(allUserTasks.length)) {
      return NextResponse.json(
        { error: 'Maximum task limit reached. Delete or cancel existing tasks first.' },
        { status: 403 },
      );
    }

    const now = Date.now();
    const nextExecutionAt = computeNextExecution(frequency as VirtualsTaskFrequency, now);
    const amountWei = BigInt(Math.round(amount * 1_000_000));

    const record: VirtualsTaskRecord = {
      id: crypto.randomUUID(),
      agentId,
      userAddress,
      frequency: frequency as VirtualsTaskFrequency,
      amount: amountWei,
      tokenSymbol: 'USDC',
      recipientEmail,
      status: 'active',
      executionCount: 0,
      nextExecutionAt,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const created = await repo.createTask(record);
    auditLog({ operation: 'create', taskId: record.id, userAddress, timestamp: now });
    return NextResponse.json({ task: serializeTask(created), created: true }, { status: 201 });
  } catch (error) {
    logger.error('[VirtualsTasks POST] failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeTask(t: VirtualsTaskRecord) {
  return {
    ...t,
    amount: t.amount.toString(),
  };
}

function computeNextExecution(frequency: VirtualsTaskFrequency, fromMs: number): number {
  switch (frequency) {
    case 'hourly': return fromMs + 60 * 60 * 1000;
    case 'daily': return fromMs + 24 * 60 * 60 * 1000;
    case 'weekly': return fromMs + 7 * 24 * 60 * 60 * 1000;
    case 'opportunistic': return fromMs + 6 * 60 * 60 * 1000;
  }
}
