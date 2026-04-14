/**
 * VISIBILITY-AWARE POLLING HOOK
 *
 * Replaces raw setInterval polling across the app.
 * Pauses when tab is hidden, resumes when visible.
 *
 * Core Principles Applied:
 * - DRY: Single polling utility for all hooks/components
 * - PERFORMANT: No wasted RPC calls on background tabs
 * - MODULAR: Drop-in replacement for setInterval patterns
 */

"use client";

import { useEffect, useRef, useCallback } from 'react';

interface UseVisibilityPollingOptions {
  /** Callback to run on each interval tick */
  callback: () => void | Promise<void>;
  /** Polling interval in milliseconds */
  intervalMs: number;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
  /** Run callback immediately on mount (default: true) */
  immediate?: boolean;
}

export function useVisibilityPolling({
  callback,
  intervalMs,
  enabled = true,
  immediate = true,
}: UseVisibilityPollingOptions) {
  const savedCallback = useRef(callback);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep callback ref fresh without restarting the interval
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      savedCallback.current();
    }, intervalMs);
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    // Run immediately if requested
    if (immediate) {
      savedCallback.current();
    }

    // Start polling if tab is visible
    if (typeof document === 'undefined' || !document.hidden) {
      start();
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        // Run once on return, then resume interval
        savedCallback.current();
        start();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, start, stop, immediate]);
}
