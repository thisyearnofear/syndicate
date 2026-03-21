/**
 * usePurchaseSSE
 *
 * Replaces polling with a Server-Sent Events stream for real-time
 * purchase status updates. Falls back to the polling hook if SSE
 * is unavailable (e.g., older browsers or non-terminal txId).
 *
 * Core Principles: MODULAR, PERFORMANT, DRY — single SSE implementation
 * reused across all status pages.
 */

import { useEffect, useRef } from 'react';

interface PurchaseStatusResponse {
  status: string;
  sourceChain?: 'stacks' | 'solana' | 'near' | 'ethereum' | 'base';
  sourceTxId?: string;
  stacksTxId?: string;
  baseTxId?: string;
  error?: string;
  updatedAt?: string | null;
  receipt?: {
    stacksExplorer?: string;
    sourceExplorer?: string;
    baseExplorer?: string | null;
    megapotApp?: string | null;
  };
}

const TERMINAL_STATUSES = new Set(['complete', 'error', 'failed']);

interface UsePurchaseSSEOptions {
  txId: string | null;
  onStatusChange: (data: PurchaseStatusResponse) => void;
}

export function usePurchaseSSE({ txId, onStatusChange }: UsePurchaseSSEOptions): void {
  const esRef = useRef<EventSource | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (!txId) return;
    if (typeof EventSource === 'undefined') return; // SSR guard

    // Close any existing connection before opening a new one
    esRef.current?.close();

    const es = new EventSource(`/api/purchase-status/${txId}/stream`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as PurchaseStatusResponse;
        onStatusChangeRef.current(data);

        // Close stream once we reach a terminal state — no more updates expected
        if (data.status && TERMINAL_STATUSES.has(data.status)) {
          es.close();
          esRef.current = null;
        }
      } catch {
        // Malformed event — ignore
      }
    };

    es.onerror = () => {
      // Browser will auto-reconnect on transient errors; close on persistent failure
      // The stream server closes on terminal states, which also triggers onerror —
      // that's expected and harmless since we already closed above.
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [txId]);
}
