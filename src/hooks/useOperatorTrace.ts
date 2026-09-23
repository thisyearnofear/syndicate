'use client';

/**
 * OPERATOR TRACE — client polling for the per-purchase audit trail.
 *
 * Reads GET /api/agent/trace?source=…&sourceTxId=… (keeper journal entries
 * joined by the structured tool_id key) on the same 30s cadence as the
 * purchase-status tracker. Fail-soft: an endpoint error is surfaced as
 * status 'error' and never blocks or fakes the purchase state itself —
 * the purchase row remains the lifecycle source of truth.
 */

import { useEffect, useState } from 'react';
import type { OperatorReplayEntry } from '@/components/operators/OperatorRunTimeline';

export type OperatorTraceSource = 'stacks-keeper' | 'xlayer-rail';

export interface OperatorTraceRun {
  sessionId: string;
  entries: OperatorReplayEntry[];
}

export interface OperatorTraceState {
  status: 'idle' | 'loading' | 'ok' | 'error';
  found: boolean;
  runs: OperatorTraceRun[];
  lastUpdated: number | null;
}

const IDLE: OperatorTraceState = {
  status: 'idle',
  found: false,
  runs: [],
  lastUpdated: null,
};

export function useOperatorTrace(
  source: OperatorTraceSource,
  sourceTxId: string | null,
  pollMs = 30_000,
): OperatorTraceState {
  const [state, setState] = useState<OperatorTraceState>(IDLE);

  useEffect(() => {
    if (!sourceTxId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/agent/trace?source=${encodeURIComponent(source)}&sourceTxId=${encodeURIComponent(sourceTxId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          found?: boolean;
          runs?: OperatorTraceRun[];
        };
        if (cancelled) return;
        setState({
          status: 'ok',
          found: Boolean(json.found),
          runs: Array.isArray(json.runs) ? json.runs : [],
          lastUpdated: Date.now(),
        });
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, status: 'error' }));
      }
    };

    void load();
    const timer = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [source, sourceTxId, pollMs]);

  // Derived reset: with no tx id the trace is definitionally idle — no
  // setState-in-effect needed (react-hooks/set-state-in-effect).
  return sourceTxId ? state : IDLE;
}
