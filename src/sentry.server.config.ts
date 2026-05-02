/**
 * Sentry Server Configuration
 *
 * Core Principles:
 * - CLEAN: Single config for server-side error tracking
 * - SECURE: No PII, no sensitive data in breadcrumbs
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance monitoring sample rate
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  // Don't send default PII
  sendDefaultPii: false,

  // Strip sensitive data from breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    // Remove auth headers from fetch breadcrumbs
    if (breadcrumb.category === 'fetch' && breadcrumb.data?.headers) {
      delete breadcrumb.data.headers;
    }
    return breadcrumb;
  },
});
