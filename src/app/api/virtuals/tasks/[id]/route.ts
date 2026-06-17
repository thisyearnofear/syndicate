/**
 * Virtuals Task by ID
 *
 * GET    /api/virtuals/tasks/[id]            — fetch one task
 * PATCH  /api/virtuals/tasks/[id]            — pause / resume / update
 * DELETE /api/virtuals/tasks/[id]            — cancel and remove
 *
 * Phase 3.5 — user-facing surface for the Virtuals ACP agent.
 *
 * Auth: userAddress in the request body / query is trusted. The existing
 * automation routes follow the same pattern; a future hardening pass can
 * add signed-message verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getVirtualsTaskRepository,
  type VirtualsTaskRecord,
  type VirtualsTaskFrequency,
  type VirtualsTaskStatus,
} from '@/lib/db/schema/virtualsTasks';
import { ensureVirtualsTasksTable } from '@/lib/db/repositories/virtualsTaskRepository';
import { logger } from '@/lib/logger';

const VALID_FREQUENCIES: ReadonlySet<VirtualsTaskFrequency> = new Set([
  'hourly', 'daily', 'weekly', 'opportunistic',
]);

const VALID_STATUSES: ReadonlySet<VirtualsTaskStatus> = new Set([
  'active', 'paused', 'cancelled', 'failed',
]);

function isValidAddress(addr: unknown): addr is `0x${string}` {
  return typeof addr === 'string'
    && addr.startsWith('0x')
    && addr.length === 42
    && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function serializeTask(t: VirtualsTaskRecord) {
  return { ...t, amount: t.amount.toString() };
}

// ---------------------------------------------------------------------------
// GET /api/virtuals/tasks/[id]?userAddress=0x...
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await ensureVirtualsTasksTable();

    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    if (!isValidAddress(userAddress)) {
      return NextResponse.json({ error: 'userAddress query param is required' }, { status: 400 });
    }

    const repo = getVirtualsTaskRepository();
    const task = await repo.getTask(params.id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (task.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      // Don't leak existence of tasks owned by other users.
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task: serializeTask(task) });
  } catch (error) {
    logger.error('[VirtualsTasksId GET] failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/virtuals/tasks/[id]
// Body: { userAddress, isActive?, status?, frequency?, amount?, recipientEmail? }
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await ensureVirtualsTasksTable();

    const body = await req.json().catch(() => ({}));
    const { userAddress, isActive, status, frequency, amount, recipientEmail } = body ?? {};

    if (!isValidAddress(userAddress)) {
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }

    if (frequency !== undefined && !VALID_FREQUENCIES.has(frequency)) {
      return NextResponse.json(
        { error: `frequency must be one of: ${Array.from(VALID_FREQUENCIES).join(', ')}` },
        { status: 400 },
      );
    }
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${Array.from(VALID_STATUSES).join(', ')}` },
        { status: 400 },
      );
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
    }
    if (amount !== undefined && (typeof amount !== 'number' || !isFinite(amount) || amount <= 0)) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }
    if (recipientEmail !== undefined && (typeof recipientEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))) {
      return NextResponse.json({ error: 'recipientEmail must be a valid email address' }, { status: 400 });
    }

    const repo = getVirtualsTaskRepository();
    const existing = await repo.getTask(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (existing.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updates: Partial<VirtualsTaskRecord> = {};
    if (isActive !== undefined) updates.isActive = isActive;
    if (status !== undefined) updates.status = status;
    if (frequency !== undefined) {
      updates.frequency = frequency;
      // Frequency change implies a reschedule.
      updates.nextExecutionAt = computeNextExecution(frequency, Date.now());
    }
    if (amount !== undefined) {
      updates.amount = BigInt(Math.round(amount * 1_000_000));
    }
    if (recipientEmail !== undefined) updates.recipientEmail = recipientEmail;

    // If pausing via isActive=false, also reflect in status so the UI badge is correct.
    if (isActive === false && status === undefined) {
      updates.status = 'paused';
    }
    // If resuming, also flip status back to active.
    if (isActive === true && status === undefined && existing.status === 'paused') {
      updates.status = 'active';
    }

    const updated = await repo.updateTask(params.id, updates);
    return NextResponse.json({ task: serializeTask(updated) });
  } catch (error) {
    logger.error('[VirtualsTasksId PATCH] failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/virtuals/tasks/[id]?userAddress=0x...
// Soft-delete: flips isActive=false + status='cancelled' so the row stays
// around for the activity log. Hard delete is available via repository
// but not exposed here.
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await ensureVirtualsTasksTable();

    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get('userAddress');
    if (!isValidAddress(userAddress)) {
      return NextResponse.json({ error: 'userAddress query param is required' }, { status: 400 });
    }

    const repo = getVirtualsTaskRepository();
    const existing = await repo.getTask(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (existing.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await repo.updateTask(params.id, {
      isActive: false,
      status: 'cancelled',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('[VirtualsTasksId DELETE] failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function computeNextExecution(frequency: VirtualsTaskFrequency, fromMs: number): number {
  switch (frequency) {
    case 'hourly': return fromMs + 60 * 60 * 1000;
    case 'daily': return fromMs + 24 * 60 * 60 * 1000;
    case 'weekly': return fromMs + 7 * 24 * 60 * 60 * 1000;
    case 'opportunistic': return fromMs + 6 * 60 * 60 * 1000;
  }
}
