/**
 * Sentry Client Configuration
 *
 * Core Principles:
 * - CLEAN: Single config for browser-side error tracking
 * - PERFORMANT: Sample rates tuned for production
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance monitoring sample rate (10% in production)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay sample rate (1% in production, only on errors)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 1.0,

  // Environment
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  // Don't send default PII (addresses, etc.)
  sendDefaultPii: false,

  // Ignore common browser errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications.',
    'Non-Error promise rejection captured',
    'Network request failed',
    'NetworkError',
    'Failed to fetch',
    'Load failed',
    'cancelled',
    'user rejected',
    'User rejected',
  ],

  // Ignore URLs that aren't useful
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],
});
