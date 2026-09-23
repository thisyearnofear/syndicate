'use client';

/**
 * RAIL RECEIPT — client state for the X Layer ticket receipt on
 * /purchase-status?chain=xlayer.
 *
 * Polls GET /api/purchase-status?txId= every 5s until the purchase reaches
 * a terminal state (complete / error / not_found), then stops. Also reads
 * the xlayer-rail operator trace so the payment leg can tell "settling"
 * from "not collected" — the purchase row alone can't.
 */

import { useEffect, useRef, useState } from 'react';
import type { RailStatusJson } from '@/components/rail/deriveRailReceiptState';
import type { OperatorReplayEntry } from '@/components/operators/OperatorRunTimeline';

export interface RailReceiptData {
  statusJson: RailStatusJson | null;
  traceEntries: OperatorReplayEntry[];
  statusLoaded: boolean;
  traceLoaded: boolean;
  error: boolean;
}

const TERMINAL = new Set(['complete', 'error', 'not_found']);

export function useRailReceipt(txId: string | null, pollMs = 5_000): RailReceiptData {
  const [data, setData] = useState<RailReceiptData>({
    statusJson: null,
    traceEntries: [],
    statusLoaded: false,
    traceLoaded: false,
    error: false,
  });
  const terminalRef = useRef(false);

  useEffect(() => {
    if (!txId) return;
    terminalRef.current = false;
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const res = await fetch(`/api/purchase-status?txId=${encodeURIComponent(txId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RailStatusJson;
        if (cancelled) return;
        terminalRef.current = TERMINAL.has(json.status ?? '');
        setData((prev) => ({ ...prev, statusJson: json, statusLoaded: true }));
      } catch {
        if (!cancelled) setData((prev) => ({ ...prev, statusLoaded: true, error: true }));
      }
    };

    const loadTrace = async () => {
      try {
        const res = await fetch(
          `/api/agent/trace?source=xlayer-rail&sourceTxId=${encodeURIComponent(txId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          runs?: { entries?: OperatorReplayEntry[] }[];
        };
        if (cancelled) return;
        const entries = (json.runs ?? []).flatMap((r) => r.entries ?? []);
        setData((prev) => ({ ...prev, traceEntries: entries, traceLoaded: true }));
      } catch {
        if (!cancelled) setData((prev) => ({ ...prev, traceLoaded: true }));
      }
    };

    void loadStatus();
    void loadTrace();
    const timer = setInterval(() => {
      if (terminalRef.current) return; // terminal: stop polling status
      void loadStatus();
      void loadTrace();
    }, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [txId, pollMs]);

  return data;
}
