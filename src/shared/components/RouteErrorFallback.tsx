'use client';

/**
 * ROUTE ERROR FALLBACK
 *
 * Shared UI for per-route Next.js error.tsx boundaries.
 * Use by creating an `error.tsx` in each route folder that re-exports
 * a wrapper passing a route-specific label and a "Go home" action.
 *
 * Reports to Sentry (when enabled) and renders a recovery UI.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export interface RouteErrorFallbackProps {
  /** Heading shown to the user. */
  title?: string;
  /** Short description below the title. */
  description?: string;
  /** Error caught by the boundary. */
  error: Error & { digest?: string };
  /** Reset callback from Next.js (re-renders the route segment). */
  reset: () => void;
  /** Optional: route label shown above the title (e.g., "Portfolio"). */
  routeLabel?: string;
}

export function RouteErrorFallback({
  title = 'Something went wrong',
  description = 'An unexpected error occurred while loading this page. Please try again.',
  error,
  reset,
  routeLabel,
}: RouteErrorFallbackProps) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_SENTRY !== 'true') return;
    if (process.env.NODE_ENV !== 'production') return;

    import('@sentry/nextjs')
      .then((Sentry) => Sentry.captureException(error))
      .catch(() => {
        // Sentry SDK not available — already logged in dev console below
      });

    // Always log to the dev console for visibility
    console.error(`[RouteErrorFallback${routeLabel ? `:${routeLabel}` : ''}]`, error);
  }, [error, routeLabel]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="glass-premium rounded-2xl p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4" aria-hidden>
          ⚠️
        </div>
        {routeLabel && (
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">{routeLabel}</p>
        )}
        <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
        <p className="text-gray-300 mb-6">{description}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2.5 px-5 rounded-xl transition-all"
          >
            Try again
          </button>
          <Link
            href="/"
            className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 px-5 rounded-xl transition-all"
          >
            Go home
          </Link>
        </div>

        {error.digest && (
          <p className="text-xs text-gray-500 mt-6 font-mono">digest: {error.digest}</p>
        )}

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="text-xs text-gray-400 cursor-pointer">Error details (dev only)</summary>
            <pre className="mt-2 text-xs text-red-400 bg-black/30 p-3 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
