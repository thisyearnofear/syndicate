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

let initialized = false;

/**
 * Initialize the default subscribers (console + logger).
 * Safe to call multiple times — only registers once.
 */
function init(): void {
  if (initialized) return;
  subscribe(consoleSubscriber);
  subscribe(loggerSubscriber);
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
} as const;
