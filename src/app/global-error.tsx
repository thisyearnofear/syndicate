'use client';

/**
 * GLOBAL ERROR BOUNDARY
 *
 * Core Principles Applied:
 * - CLEAN: Catches unhandled errors at the app root
 * - SECURE: No stack traces in production
 * - Reports to Sentry via captureException
 */

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#94a3b8', marginBottom: '2rem', maxWidth: '28rem' }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={reset}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
