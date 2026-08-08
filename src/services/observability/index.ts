/**
 * LIFECYCLE OBSERVABILITY — Public API
 *
 * Structured event layer for money-moving operations.
 *
 * Usage:
 *   import { lifecycle } from '@/services/observability';
 *
 *   lifecycle.emit('purchase.submitted', {
 *     chain: 'base',
 *     chainId: 8453,
 *     transactionHash: '0x...',
 *     userAddress: '0xABC...',
 *     operation: 'purchase',
 *     provider: 'megapot',
 *   });
 *
 *   // Subscribe for custom handling:
 *   const unsub = lifecycle.subscribe((event) => { ... });
 *
 *   // Initialize default subscribers:
 *   lifecycle.init();
 */

export type {
  LifecycleEvent,
  LifecycleEventName,
  EventCategory,
  EventError,
  EmitOptions,
} from './types';

export type { EventSubscriber } from './emitter';

import { emit, subscribe, getHistory, reset, subscriberCount } from './emitter';
import { consoleSubscriber, loggerSubscriber } from './subscribers';
import { analyticsSubscriber, startAnalyticsFlush, stopAnalyticsFlush, getAnalyticsSnapshot, resetAnalytics } from './analyticsSubscriber';

let initialized = false;

/**
 * Initialize the default subscribers (console + logger + analytics).
 * Safe to call multiple times — only registers once.
 */
function init(): void {
  if (initialized) return;
  subscribe(consoleSubscriber);
  subscribe(loggerSubscriber);
  subscribe(analyticsSubscriber);
  startAnalyticsFlush();
  initialized = true;
}

/**
 * The lifecycle observability namespace.
 * Import as: `import { lifecycle } from '@/services/observability';`
 */
export const lifecycle = {
  emit,
  subscribe,
  getHistory,
  reset,
  subscriberCount,
  init,
  /** Analytics-specific utilities. */
  analytics: {
    getSnapshot: getAnalyticsSnapshot,
    stop: stopAnalyticsFlush,
    reset: resetAnalytics,
  },
} as const;
