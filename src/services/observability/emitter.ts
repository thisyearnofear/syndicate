/**
 * LIFECYCLE OBSERVABILITY — Event Emitter
 *
 * Lightweight event bus for lifecycle events. Supports:
 *   - Typed emit() with builder pattern
 *   - Subscriber registration (for logger, analytics, monitoring)
 *   - Event history buffer (last N events, for debugging)
 *
 * This module is intentionally side-effect-free in tests and SSR-safe.
 * It does not perform network I/O itself — subscribers handle routing.
 */

import type {
  LifecycleEvent,
  LifecycleEventName,
  EventCategory,
  EmitOptions,
} from './types';

// ─── Subscriber type ──────────────────────────────────────────────────────────

export type EventSubscriber = (event: LifecycleEvent) => void;

// ─── Configuration ────────────────────────────────────────────────────────────

/** Maximum events retained in the debug history buffer. */
const MAX_HISTORY = 200;

// ─── Internal state ───────────────────────────────────────────────────────────

const subscribers: EventSubscriber[] = [];
const history: LifecycleEvent[] = [];

// ─── Category extraction ──────────────────────────────────────────────────────

function extractCategory(name: LifecycleEventName): EventCategory {
  const prefix = name.split('.')[0];
  switch (prefix) {
    case 'purchase': return 'purchase';
    case 'bridge': return 'bridge';
    case 'vault': return 'vault';
    case 'automation': return 'automation';
    case 'execution': return 'execution';
    case 'verification': return 'verification';
    default: return 'execution';
  }
}

// ─── Sanitization ─────────────────────────────────────────────────────────────

function sanitizeAddress(address?: string): string | null {
  if (!address) return null;
  if (address.length <= 10) return address;
  return `${address.slice(0, 10)}…`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Emit a structured lifecycle event.
 *
 * Usage:
 *   emit('purchase.submitted', { chain: 'base', chainId: 8453, transactionHash: '0x...' });
 */
export function emit(name: LifecycleEventName, opts: EmitOptions = {}): LifecycleEvent {
  const event: LifecycleEvent = {
    name,
    category: extractCategory(name),
    timestamp: new Date().toISOString(),
    chain: opts.chain ?? null,
    chainId: opts.chainId ?? null,
    operation: opts.operation ?? null,
    provider: opts.provider ?? null,
    transactionHash: opts.transactionHash ?? null,
    transferId: opts.transferId ?? null,
    userAddressPrefix: sanitizeAddress(opts.userAddress),
    error: opts.error ?? null,
    metadata: opts.metadata ?? {},
  };

  // Buffer for debugging
  history.push(event);
  if (history.length > MAX_HISTORY) {
    history.shift();
  }

  // Notify all subscribers
  for (const sub of subscribers) {
    try {
      sub(event);
    } catch {
      // Subscriber errors must never break the emitting flow.
    }
  }

  return event;
}

/**
 * Subscribe to all lifecycle events.
 * Returns an unsubscribe function.
 */
export function subscribe(fn: EventSubscriber): () => void {
  subscribers.push(fn);
  return () => {
    const idx = subscribers.indexOf(fn);
    if (idx >= 0) subscribers.splice(idx, 1);
  };
}

/**
 * Get the recent event history (most recent last).
 * Useful for debugging and in-app diagnostics.
 */
export function getHistory(): readonly LifecycleEvent[] {
  return history;
}

/**
 * Clear all subscribers and history.
 * Use in tests to reset state between cases.
 */
export function reset(): void {
  subscribers.length = 0;
  history.length = 0;
}

/**
 * Get the current subscriber count (for diagnostics).
 */
export function subscriberCount(): number {
  return subscribers.length;
}
