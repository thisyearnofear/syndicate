/**
 * LIFECYCLE OBSERVABILITY — Default Subscribers
 *
 * Pre-built subscribers that route lifecycle events to common sinks:
 *   - Console logger (structured JSON, development only)
 *   - Application logger (production)
 *
 * Add custom subscribers via `subscribe()` from the emitter module.
 */

import type { LifecycleEvent } from './types';
import type { EventSubscriber } from './emitter';

/**
 * Console subscriber — logs events as structured JSON in development.
 * Suppresses in production to avoid console noise.
 */
export const consoleSubscriber: EventSubscriber = (event: LifecycleEvent) => {
  if (process.env.NODE_ENV !== 'development') return;

  const prefix = event.error ? '⚠️' : '→';
  const summary = [
    prefix,
    event.name,
    event.chain ? `[${event.chain}]` : '',
    event.transactionHash ? `tx:${event.transactionHash.slice(0, 10)}…` : '',
    event.error ? `ERR:${event.error.code}` : '',
  ].filter(Boolean).join(' ');

   
  console.log(`[Lifecycle] ${summary}`, event.metadata);
};

/**
 * Logger subscriber — routes events to the application logger.
 * Lazily imports `@/lib/logger` to avoid circular deps at module load.
 */
export const loggerSubscriber: EventSubscriber = (event: LifecycleEvent) => {
  // Lazy import to avoid module init order issues
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('@/lib/logger') as { logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void } };
    const logData = {
      event: event.name,
      category: event.category,
      chain: event.chain,
      chainId: event.chainId,
      provider: event.provider,
      operation: event.operation,
      txHash: event.transactionHash,
      transferId: event.transferId,
      user: event.userAddressPrefix,
      error: event.error,
      ...event.metadata,
    };

    if (event.error) {
      logger.warn(`[Lifecycle:${event.category}] ${event.name}`, logData);
    } else {
      logger.info(`[Lifecycle:${event.category}] ${event.name}`, logData);
    }
  } catch {
    // If logger is unavailable (e.g., edge runtime), silently skip.
  }
};
