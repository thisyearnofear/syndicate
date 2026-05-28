/**
 * Sentry Instrumentation
 *
 * Initializes Sentry for server-side and edge runtime.
 * Next.js automatically loads this file.
 *
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = (...args: any[]) => {
  // @ts-ignore - Sentry might not have types for this hook yet in some versions
  import('@sentry/nextjs').then((Sentry) => {
    // @ts-ignore
    Sentry.captureRequestError(...args);
  });
};
