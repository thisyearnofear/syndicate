/**
 * Sentry Instrumentation
 *
 * Initializes Sentry for server-side and edge runtime.
 * Next.js automatically loads this file.
 *
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */

export async function register() {
  if (!isSentryRuntimeEnabled()) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onRequestError = (...args: any[]) => {
  if (!isSentryRuntimeEnabled()) return;

  import('@sentry/nextjs').then((Sentry) => {
    // @ts-expect-error - Sentry captureRequestError may not be typed
    Sentry.captureRequestError(...args);
  });
};

function isSentryRuntimeEnabled(): boolean {
  return (
    process.env.ENABLE_SENTRY_RUNTIME === 'true' &&
    Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
  );
}
