/**
 * ANALYTICS SUBSCRIBER — Funnel Tracking for Lifecycle Events
 *
 * Consumes lifecycle events and derives:
 *   - Funnel step completion rates
 *   - Drop-off points (which phase users abandon at)
 *   - Time-to-completion per operation
 *   - Error categorization by phase and chain
 *
 * Data is buffered locally and flushed to `/api/analytics/events` in batches.
 * In development, events are also logged to console for visibility.
 *
 * Privacy: only sanitized address prefixes are stored (never full addresses).
 * No private keys, balances, or permit data is ever included.
 */

import type { LifecycleEvent } from './types';
import type { EventSubscriber } from './emitter';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FunnelSession {
  /** Unique session ID (random, not user-identifying). */
  id: string;
  /** Operation type (purchase, deposit, bridge, etc.). */
  operation: string;
  /** Chain where the operation executes. */
  chain: string | null;
  /** Provider/protocol involved. */
  provider: string | null;
  /** Sanitized user address prefix. */
  userPrefix: string | null;
  /** Ordered list of events in this session. */
  steps: FunnelStep[];
  /** Session start timestamp (ISO). */
  startedAt: string;
  /** Session end timestamp (ISO), or null if still active. */
  completedAt: string | null;
  /** Terminal outcome. */
  outcome: 'completed' | 'failed' | 'in_progress';
  /** Duration in milliseconds (null if still in progress). */
  durationMs: number | null;
  /** Error info if failed. */
  error: { code: string; phase: string; userCancelled: boolean } | null;
}

export interface FunnelStep {
  event: string;
  timestamp: string;
  /** Milliseconds since session start. */
  elapsedMs: number;
}

export interface AnalyticsFlushPayload {
  sessions: FunnelSession[];
  flushedAt: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/** Maximum buffered sessions before auto-flush. */
const MAX_BUFFER_SIZE = 50;

/** Flush interval (ms). */
const FLUSH_INTERVAL_MS = 30_000;

/** Events that start a new funnel session. */
const SESSION_START_EVENTS = new Set([
  'purchase.initiated',
  'vault.deposit_initiated',
  'bridge.started',
]);

/** Events that end a funnel session successfully. */
const SESSION_COMPLETE_EVENTS = new Set([
  'purchase.confirmed',
  'vault.deposit_confirmed',
  'bridge.confirmed',
]);

/** Events that end a funnel session with failure. */
const SESSION_FAIL_EVENTS = new Set([
  'purchase.failed',
  'vault.operation_failed',
  'bridge.failed',
]);

// ─── Internal State ───────────────────────────────────────────────────────────

/** Active sessions keyed by a derived session key (operation + userPrefix + chain). */
const activeSessions = new Map<string, FunnelSession>();

/** Completed sessions buffer waiting to be flushed. */
const completedBuffer: FunnelSession[] = [];

/** Flush timer reference. */
let flushTimer: ReturnType<typeof setInterval> | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `fs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function deriveSessionKey(event: LifecycleEvent): string {
  return `${event.category}:${event.userAddressPrefix ?? 'anon'}:${event.chain ?? 'unknown'}`;
}

function createSession(event: LifecycleEvent): FunnelSession {
  return {
    id: generateId(),
    operation: event.operation ?? event.category,
    chain: event.chain,
    provider: event.provider,
    userPrefix: event.userAddressPrefix,
    steps: [{
      event: event.name,
      timestamp: event.timestamp,
      elapsedMs: 0,
    }],
    startedAt: event.timestamp,
    completedAt: null,
    outcome: 'in_progress',
    durationMs: null,
    error: null,
  };
}

function addStep(session: FunnelSession, event: LifecycleEvent): void {
  const startMs = new Date(session.startedAt).getTime();
  const nowMs = new Date(event.timestamp).getTime();
  session.steps.push({
    event: event.name,
    timestamp: event.timestamp,
    elapsedMs: nowMs - startMs,
  });
}

function finalizeSession(session: FunnelSession, outcome: 'completed' | 'failed', event: LifecycleEvent): void {
  session.outcome = outcome;
  session.completedAt = event.timestamp;
  session.durationMs = new Date(event.timestamp).getTime() - new Date(session.startedAt).getTime();
  if (outcome === 'failed' && event.error) {
    session.error = {
      code: event.error.code,
      phase: event.error.phase,
      userCancelled: event.error.userCancelled,
    };
  }
}

// ─── Flush Logic ──────────────────────────────────────────────────────────────

async function flush(): Promise<void> {
  if (completedBuffer.length === 0) return;

  const sessions = completedBuffer.splice(0, completedBuffer.length);
  const payload: AnalyticsFlushPayload = {
    sessions,
    flushedAt: new Date().toISOString(),
  };

  // Development: log summary
  if (process.env.NODE_ENV === 'development') {
    const completed = sessions.filter(s => s.outcome === 'completed').length;
    const failed = sessions.filter(s => s.outcome === 'failed').length;
    const avgDuration = sessions
      .filter(s => s.durationMs !== null)
      .reduce((sum, s) => sum + s.durationMs!, 0) / (sessions.length || 1);

     
    console.log(
      `[Analytics] Flushing ${sessions.length} sessions: ${completed} completed, ${failed} failed, avg ${Math.round(avgDuration)}ms`,
    );
  }

  // Send to analytics endpoint (fire-and-forget, never block the UI)
  try {
    if (typeof fetch !== 'undefined') {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Analytics flush failure is non-critical — silently drop.
      });
    }
  } catch {
    // Never throw from analytics code.
  }
}

// ─── Subscriber ───────────────────────────────────────────────────────────────

/**
 * Analytics subscriber for the lifecycle event bus.
 *
 * Tracks funnel sessions: initiated → steps → completed/failed.
 * Buffers completed sessions and flushes them periodically.
 */
export const analyticsSubscriber: EventSubscriber = (event: LifecycleEvent) => {
  const key = deriveSessionKey(event);

  // Start a new session
  if (SESSION_START_EVENTS.has(event.name)) {
    const session = createSession(event);
    activeSessions.set(key, session);
    return;
  }

  // Complete a session
  if (SESSION_COMPLETE_EVENTS.has(event.name)) {
    const session = activeSessions.get(key);
    if (session) {
      addStep(session, event);
      finalizeSession(session, 'completed', event);
      activeSessions.delete(key);
      completedBuffer.push(session);
      if (completedBuffer.length >= MAX_BUFFER_SIZE) void flush();
    }
    return;
  }

  // Fail a session
  if (SESSION_FAIL_EVENTS.has(event.name)) {
    const session = activeSessions.get(key);
    if (session) {
      addStep(session, event);
      finalizeSession(session, 'failed', event);
      activeSessions.delete(key);
      completedBuffer.push(session);
      if (completedBuffer.length >= MAX_BUFFER_SIZE) void flush();
    }
    return;
  }

  // Intermediate step — add to existing session
  const session = activeSessions.get(key);
  if (session) {
    addStep(session, event);
  }
};

// ─── Lifecycle Control ────────────────────────────────────────────────────────

/**
 * Start the periodic flush timer.
 * Call once during app initialization (e.g., in Providers.tsx or layout).
 */
export function startAnalyticsFlush(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  if (typeof flushTimer === 'object' && 'unref' in flushTimer) {
    flushTimer.unref?.();
  }
}

/**
 * Stop the flush timer and flush any remaining buffered sessions.
 */
export async function stopAnalyticsFlush(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  await flush();
}

/**
 * Get a snapshot of active and buffered sessions (for debugging/diagnostics).
 */
export function getAnalyticsSnapshot(): {
  activeSessions: FunnelSession[];
  buffered: FunnelSession[];
} {
  return {
    activeSessions: Array.from(activeSessions.values()),
    buffered: [...completedBuffer],
  };
}

/**
 * Reset all analytics state (for tests).
 */
export function resetAnalytics(): void {
  activeSessions.clear();
  completedBuffer.length = 0;
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
