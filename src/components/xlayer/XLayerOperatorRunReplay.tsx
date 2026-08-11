'use client';

/**
 * LATEST OPERATOR RUN — public replay of the server-side keeper loop.
 *
 * The interactive transcript lives in the visitor's localStorage, which
 * means a judge with no wallet sees an empty panel. This card fetches the
 * latest keeper-cron session (persisted server-side in agent_run_events)
 * and replays it read-only: plan, oracle seeding, draw open, receipt links.
 * No wallet required; entries refresh on a poll.
 */

import { useEffect, useState } from 'react';
import { ExternalLink, Radio } from 'lucide-react';
import { CompactCard } from '@/shared/components/premium/CompactLayout';
import { xLayerExplorerTx } from '@/config/xlayer';

interface ReplayEntry {
  id: string;
  kind: string;
  label: string;
  detail?: string | null;
  toolId?: string | null;
  txHash?: string | null;
  source?: string | null;
  createdAt: number;
}

const KIND_STYLE: Record<string, string> = {
  plan: 'bg-violet-500/20 text-violet-200',
  plan_failed: 'bg-rose-500/20 text-rose-200',
  execute: 'bg-amber-500/20 text-amber-200',
  complete: 'bg-emerald-500/20 text-emerald-200',
  fail: 'bg-rose-500/20 text-rose-200',
};

const KIND_LABEL: Record<string, string> = {
  plan: 'plan',
  plan_failed: 'plan failed',
  execute: 'executing',
  complete: 'completed',
  fail: 'failed',
};

const POLL_MS = 60_000;

export function XLayerOperatorRunReplay() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ReplayEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/agent/xlayer/latest-run', { cache: 'no-store' });
        if (!res.ok) throw new Error(`latest-run ${res.status}`);
        const data = (await res.json()) as { sessionId: string | null; entries: ReplayEntry[] };
        if (cancelled) return;
        setSessionId(data.sessionId);
        setEntries(data.entries);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <CompactCard variant="glass" padding="lg" hover={false} className="border-violet-400/15 bg-violet-500/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-violet-200">
          <Radio className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Latest operator run</span>
        </div>
        {sessionId && (
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-500">
            session …{sessionId.slice(-6)}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        The operator keeper runs this pool on a schedule — server-signed, receipt-verified, and
        persisted so anyone can audit it. No wallet needed to read this trail.
      </p>

      {failed && (
        <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-500">
          Operator run history is temporarily unavailable. The interactive agent loop above still works.
        </p>
      )}

      {!failed && entries !== null && entries.length === 0 && (
        <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-500">
          No operator run recorded yet — the keeper records its next scheduled tick here.
        </p>
      )}

      {!failed && entries && entries.length > 0 && (
        <ul className="mt-4 max-h-72 divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10 bg-black/20">
          {entries.map((entry) => (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      KIND_STYLE[entry.kind] ?? 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {KIND_LABEL[entry.kind] ?? entry.kind}
                  </span>
                  <span className="truncate text-sm text-white">{entry.label}</span>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">
                  {new Date(entry.createdAt).toLocaleTimeString()}
                </span>
              </div>
              {entry.detail && <p className="mt-1 text-xs text-slate-400">{entry.detail}</p>}
              {entry.txHash && (
                <a
                  href={xLayerExplorerTx(entry.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200"
                >
                  receipt {entry.txHash.slice(0, 8)}…
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </CompactCard>
  );
}
