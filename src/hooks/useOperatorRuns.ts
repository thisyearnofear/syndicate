'use client';

/**
 * OPERATOR STATUS HOOKS — one polling contract for every keeper replay.
 *
 * All three keepers persist to agent_run_events; this hook reads their
 * public latest-run endpoints on one poll cadence (30s, matching the
 * purchase-status tracker) and exposes the same shape regardless of world,
 * so the /operators page (and any future inset) speaks one language.
 *
 * Read-only, keyless, fail-soft: a world whose endpoint is down shows
 * status 'error' for that world and never blocks the others.
 */

import { useEffect, useState } from 'react';
import type { OperatorReplayEntry } from '@/components/operators/OperatorRunTimeline';

export type OperatorWorld = 'xlayer' | 'season' | 'stacks' | 'rail';

export interface OperatorRunState {
  sessionId: string | null;
  entries: OperatorReplayEntry[];
  lastUpdated: number | null;
  status: 'idle' | 'loading' | 'ok' | 'error';
}

const EMPTY: OperatorRunState = {
  sessionId: null,
  entries: [],
  lastUpdated: null,
  status: 'idle',
};

const ENDPOINTS: Record<OperatorWorld, string> = {
  xlayer: '/api/agent/xlayer/latest-run',
  season: '/api/agent/season/latest-run',
  stacks: '/api/agent/stacks/latest-run',
  rail: '/api/agent/xlayer-rail/latest-run',
};

function normalize(json: unknown): OperatorRunState {
  const record = (json ?? {}) as {
    sessionId?: unknown;
    entries?: unknown;
    run?: { sessionId?: unknown; entries?: unknown } | null;
  };
  // xlayer returns {sessionId, entries}; season/stacks return {run:{...}}.
  const session = record.run ?? record;
  const entries = Array.isArray(session.entries) ? (session.entries as OperatorReplayEntry[]) : [];
  return {
    sessionId: typeof session.sessionId === 'string' ? session.sessionId : null,
    entries,
    lastUpdated: Date.now(),
    status: 'ok',
  };
}

export function useOperatorRun(world: OperatorWorld, pollMs = 30_000): OperatorRunState {
  const [state, setState] = useState<OperatorRunState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    const endpoint = ENDPOINTS[world];

    const load = async () => {
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setState(normalize(json));
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, status: 'error' }));
      }
    };

    // No synchronous 'loading' set here (react-hooks/set-state-in-effect):
    // status starts 'idle' and consumers render idle/loading identically;
    // the first response flips it to ok/error.
    void load();
    const timer = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [world, pollMs]);

  return state;
}
