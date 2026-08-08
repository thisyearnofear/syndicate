/**
 * VIRTUALS TASKS API — Server-Side Guards
 *
 * Centralized enforcement for the Virtuals automation routes:
 *   - Kill switch: global disable via env var
 *   - Rate limiting: per-address mutation throttle
 *   - Task caps: maximum tasks per user
 *   - Amount bounds: min/max USDC per task
 *   - Idempotency: duplicate mutation detection
 *
 * These guards run before business logic. They protect the system from
 * abuse without the client needing to be trusted for authorization.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Kill switch: set to "false" to disable all Virtuals task mutations. */
const VIRTUALS_TASKS_ENABLED = process.env.VIRTUALS_TASKS_ENABLED !== 'false';

/** Maximum tasks a single user can have (active + paused + cancelled). */
const MAX_TASKS_PER_USER = parseInt(process.env.VIRTUALS_MAX_TASKS_PER_USER || '25', 10);

/** Minimum task amount in human-readable USDC (e.g., 0.01). */
const MIN_TASK_AMOUNT_USDC = parseFloat(process.env.VIRTUALS_MIN_TASK_AMOUNT || '0.01');

/** Maximum task amount in human-readable USDC. */
const MAX_TASK_AMOUNT_USDC = parseFloat(process.env.VIRTUALS_MAX_TASK_AMOUNT || '10000');

/** Minimum interval between mutations from the same address (ms). */
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.VIRTUALS_RATE_LIMIT_MS || '2000', 10);

// ─── In-memory rate-limit store ───────────────────────────────────────────────
// Simple in-process tracking. For multi-instance, use Redis or similar.

const rateLimitMap = new Map<string, number>();

function isRateLimited(address: string): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(address.toLowerCase());
  if (last && now - last < RATE_LIMIT_WINDOW_MS) {
    return true;
  }
  rateLimitMap.set(address.toLowerCase(), now);
  return false;
}

// Periodic cleanup to prevent memory leak (every 60s, remove entries older than 10s)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - 10_000;
    for (const [key, ts] of rateLimitMap) {
      if (ts < cutoff) rateLimitMap.delete(key);
    }
  }, 60_000).unref?.();
}

// ─── Idempotency tracking ─────────────────────────────────────────────────────
// Stores recent mutation keys to detect duplicate submissions.

const recentMutations = new Map<string, number>();
const IDEMPOTENCY_WINDOW_MS = 5_000; // 5s dedup window

function isDuplicateMutation(key: string): boolean {
  const now = Date.now();
  const prev = recentMutations.get(key);
  if (prev && now - prev < IDEMPOTENCY_WINDOW_MS) {
    return true;
  }
  recentMutations.set(key, now);
  return false;
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - IDEMPOTENCY_WINDOW_MS * 2;
    for (const [key, ts] of recentMutations) {
      if (ts < cutoff) recentMutations.delete(key);
    }
  }, 30_000).unref?.();
}

// ─── Public Guard Functions ───────────────────────────────────────────────────

export interface GuardContext {
  userAddress: string;
  operation: 'create' | 'update' | 'delete';
  /** Unique key for idempotency check (e.g., `${operation}:${id}:${address}`). */
  idempotencyKey?: string;
}

export interface GuardResult {
  allowed: boolean;
  response?: NextResponse;
}

/**
 * Run all server-side guards. Returns `{ allowed: true }` if the request
 * may proceed, or `{ allowed: false, response }` with a ready-to-return
 * error response.
 */
export function runMutationGuards(ctx: GuardContext): GuardResult {
  // Kill switch
  if (!VIRTUALS_TASKS_ENABLED) {
    logger.warn('[VirtualsGuard] Kill switch active — mutation blocked', { operation: ctx.operation, address: ctx.userAddress });
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Automation tasks are currently disabled.' },
        { status: 503 },
      ),
    };
  }

  // Rate limit
  if (isRateLimited(ctx.userAddress)) {
    logger.warn('[VirtualsGuard] Rate limited', { operation: ctx.operation, address: ctx.userAddress });
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 },
      ),
    };
  }

  // Idempotency
  if (ctx.idempotencyKey && isDuplicateMutation(ctx.idempotencyKey)) {
    logger.info('[VirtualsGuard] Duplicate mutation detected', { key: ctx.idempotencyKey });
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Duplicate request detected. Please wait.' },
        { status: 409 },
      ),
    };
  }

  return { allowed: true };
}

/**
 * Validate that the requested amount is within acceptable bounds.
 */
export function validateAmountBounds(amount: number): string | null {
  if (amount < MIN_TASK_AMOUNT_USDC) {
    return `Amount must be at least ${MIN_TASK_AMOUNT_USDC} USDC`;
  }
  if (amount > MAX_TASK_AMOUNT_USDC) {
    return `Amount cannot exceed ${MAX_TASK_AMOUNT_USDC} USDC`;
  }
  return null;
}

/**
 * Check if a user has reached the maximum allowed task count.
 */
export function isTaskCapReached(currentTaskCount: number): boolean {
  return currentTaskCount >= MAX_TASKS_PER_USER;
}

/** Maximum tasks allowed per user (exported for test assertions). */
export const TASK_CAP = MAX_TASKS_PER_USER;

// ─── Audit Logger ─────────────────────────────────────────────────────────────

export interface AuditEntry {
  operation: 'create' | 'update' | 'delete';
  taskId: string;
  userAddress: string;
  changes?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Log a structured audit entry for a task mutation.
 * Currently writes to the application logger; can be routed to a durable
 * audit store in the future.
 */
export function auditLog(entry: AuditEntry): void {
  logger.info('[VirtualsAudit]', {
    op: entry.operation,
    taskId: entry.taskId,
    user: entry.userAddress.slice(0, 10) + '…',
    changes: entry.changes,
    ts: entry.timestamp,
  });
}
