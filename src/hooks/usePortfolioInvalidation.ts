/**
 * usePortfolioInvalidation — Cross-hook cache invalidation for portfolio data.
 *
 * When a deposit, purchase, or withdrawal completes, the originating hook
 * calls `invalidatePortfolio()` to signal all portfolio-displaying hooks
 * (useUserVaults, useTicketHistory, etc.) to refetch immediately instead
 * of waiting for their next poll interval.
 *
 * Architecture:
 *   - Uses a simple event-target pattern (no external deps)
 *   - Listeners register via `usePortfolioInvalidation(callback)`
 *   - Producers call the exported `invalidatePortfolio()` function
 *   - SSR-safe: no-ops on the server
 *
 * This replaces the need for React Query's queryClient.invalidateQueries()
 * in hooks that use useState + polling.
 */

import { useEffect, useRef } from 'react';

// ─── Event target (singleton, client-side only) ───────────────────────────────

type InvalidationListener = (reason: InvalidationReason) => void;

export interface InvalidationReason {
  /** What completed: 'deposit', 'purchase', 'withdrawal', 'bridge'. */
  operation: string;
  /** Protocol/provider (aave, megapot, etc.). */
  provider?: string;
  /** Chain where the operation settled. */
  chain?: string;
  /** Transaction hash for the completed operation. */
  transactionHash?: string;
}

const listeners = new Set<InvalidationListener>();

/**
 * Signal all portfolio hooks to refetch.
 * Call this after a deposit, purchase, or withdrawal is confirmed.
 */
export function invalidatePortfolio(reason: InvalidationReason): void {
  for (const listener of listeners) {
    try {
      listener(reason);
    } catch {
      // Listener errors must never break the producing code.
    }
  }
}

/**
 * Hook: register a callback that fires when portfolio data should be refreshed.
 *
 * Usage in useUserVaults:
 *   usePortfolioInvalidation(() => { void fetchVaultPositions(); });
 */
export function usePortfolioInvalidation(callback: InvalidationListener): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const handler: InvalidationListener = (reason) => callbackRef.current(reason);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);
}
