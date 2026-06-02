/**
 * ERROR CAPTURE
 *
 * Uses @sentry/nextjs SDK when available, falls back to console logging.
 *
 * Core Principles: MODULAR, DRY, CLEAN — single place for all error alerting.
 */

import { logger } from '@/lib/logger';

interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'info';
}

export async function captureError(
  error: Error | string,
  context: ErrorContext = {}
): Promise<void> {
  const message = error instanceof Error ? error.message : error;

  // Always log locally
  logger.error(`[captureError] ${message}`, { extra: context.extra ?? '' });

  if (!isSentryRuntimeEnabled()) return;

  // Send to Sentry SDK if available
  try {
    const Sentry = await import('@sentry/nextjs');

    Sentry.withScope((scope) => {
      if (context.tags) {
        for (const [key, value] of Object.entries(context.tags)) {
          scope.setTag(key, value);
        }
      }
      if (context.extra) {
        for (const [key, value] of Object.entries(context.extra)) {
          scope.setExtra(key, value);
        }
      }
      if (context.level) {
        scope.setLevel(context.level as 'fatal' | 'error' | 'warning' | 'info');
      }

      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(message);
      }
    });
  } catch {
    // Sentry SDK not available or failed — already logged locally above
  }
}

function isSentryRuntimeEnabled(): boolean {
  return (
    process.env.ENABLE_SENTRY_RUNTIME === 'true' &&
    Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
  );
}
