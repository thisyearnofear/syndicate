'use client';

/**
 * LATEST OPERATOR RUN — public epoch timeline of the server-side keeper.
 *
 * The run data is temporal, so it renders as a timeline, not a list:
 * execute+complete/fail pairs collapse into single action nodes spaced
 * along a spine, newest session readable left → right. Each completed
 * action carries its explorer receipt. Server-persisted (agent_run_events),
 * replayable with no wallet — the judge's audit view.
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

interface TimelineNode {
  id: string;
  kind: 'plan' | 'plan_failed' | 'complete' | 'fail';
  label: string;
  detail?: string | null;
  txHash?: string | null;
  at: number;
}

const DOT_STYLE: Record<TimelineNode['kind'], string> = {
  plan: 'bg-cyan-400 w-2.5 h-2.5',
  plan_failed: 'bg-rose-400 w-2.5 h-2.5',
  complete: 'bg-emerald-400 w-3.5 h-3.5 animate-node-complete',
  fail: 'bg-rose-400 w-2.5 h-2.5',
};

const KIND_LABEL: Record<TimelineNode['kind'], string> = {
  plan: 'plan',
  plan_failed: 'plan failed',
  complete: 'on-chain ✓',
  fail: 'failed',
};

/** Collapse an execute + its terminal complete/fail into one action node. */
function toTimeline(entries: ReplayEntry[]): TimelineNode[] {
  const nodes: TimelineNode[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.kind === 'execute') {
      const next = entries[i + 1];
      if (next && (next.kind === 'complete' || next.kind === 'fail') && next.label === e.label) {
        nodes.push({
          id: next.id,
          kind: next.kind === 'complete' ? 'complete' : 'fail',
          label: e.label,
          detail: next.detail,
          txHash: next.txHash,
          at: next.createdAt,
        });
        i++; // consume the terminal entry
        continue;
      }
      // Orphaned execute (still in flight at snapshot time) — show as plan.
      nodes.push({ id: e.id, kind: 'plan', label: e.label, detail: e.detail, txHash: null, at: e.createdAt });
      continue;
    }
    if (e.kind === 'plan' || e.kind === 'plan_failed') {
      nodes.push({
        id: e.id,
        kind: e.kind as 'plan' | 'plan_failed',
        label: e.label,
        detail: e.detail,
        txHash: e.txHash,
        at: e.createdAt,
      });
    }
  }
  return nodes;
}

const POLL_MS = 60_000;

/** Format a timestamp as both absolute time and relative age ("3:47 AM · 2h ago") */
function formatTimestamp(at: number): { abs: string; rel: string } {
  const abs = new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const diffMs = Date.now() - at;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const rel =
    diffMin < 1 ? 'just now'
    : diffMin < 60 ? `${diffMin}m ago`
    : diffHr < 24 ? `${diffHr}h ago`
    : `${diffDay}d ago`;
  return { abs, rel };
}

export function XLayerOperatorRunReplay({ bare = false }: { bare?: boolean }) {
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

  const nodes = entries ? toTimeline(entries) : [];

  const body = (
    <>
      {!bare && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-cyan-200">
            <Radio className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Latest operator run</span>
          </div>
          {sessionId && (
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-500">
              session …{sessionId.slice(-6)}
            </span>
          )}
        </div>
      )}
      {!bare && (
        <p className="mt-2 text-sm leading-6 text-slate-400">
          The operator keeper runs this pool on a schedule — server-signed, receipt-verified, persisted
          for anyone to audit. When the pool has no depositors it seeds an epoch with its own testnet
          principal (disclosed below); winnings it claims recycle back into the pot.
        </p>
      )}
      {bare && sessionId && (
        <p className="mb-1 text-[11px] text-slate-500">
          Latest operator session …{sessionId.slice(-6)} — server-signed, receipt-verified, persisted for
          anyone to audit.
        </p>
      )}

      {/* Session summary — proof-of-life sentence */}
      {!failed && nodes.length > 0 && (() => {
        const completeNodes = nodes.filter(n => n.kind === 'complete');
        const failNodes = nodes.filter(n => n.kind === 'fail' || n.kind === 'plan_failed');
        const latest = nodes[nodes.length - 1];
        const { rel } = formatTimestamp(latest.at);
        return (
          <div className={`${bare ? 'mb-3' : 'mt-3'} rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2`}>
            <p className="font-mono text-[11px] leading-5 text-slate-400">
              <span className="text-emerald-300">{completeNodes.length} on-chain</span>
              {failNodes.length > 0 && <span className="ml-2 text-rose-400">{failNodes.length} failed</span>}
              <span className="text-slate-600"> · </span>
              <span className="text-slate-400">all receipts verified</span>
              <span className="text-slate-600"> · </span>
              <span className="text-cyan-400/70">{rel}</span>
            </p>
          </div>
        );
      })()}

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

      {!failed && nodes.length > 0 && (
        <div className="relative mt-6">
          <div aria-hidden className="absolute left-3 right-3 top-[7px] h-px bg-white/10" />
          <ol className="flex snap-x gap-7 overflow-x-auto pb-2 pl-1 pt-0">
            {nodes.map((node) => (
              <li key={node.id} className="relative w-44 shrink-0 snap-start">
                <span
                  className={`block rounded-full ring-4 ring-slate-950 ${DOT_STYLE[node.kind]}`}
                />
                <p className={`mt-2.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                  node.kind === 'complete' ? 'text-emerald-400/80' : 'text-slate-500'
                }`}>
                  {KIND_LABEL[node.kind]}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-white" title={node.label}>
                  {node.label}
                </p>
                {/* Receipt link promoted above detail for complete nodes */}
                {node.txHash && node.kind === 'complete' && (
                  <a
                    href={xLayerExplorerTx(node.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/[0.08] px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 hover:border-emerald-400/50 transition-colors"
                  >
                    receipt <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {node.detail && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500" title={node.detail}>
                    {node.detail}
                  </p>
                )}
                <p className="mt-1 flex flex-col gap-0.5 text-[11px] tabular-nums text-slate-600">
                  <span>
                    {formatTimestamp(node.at).abs}
                    <span className="ml-1.5 text-slate-700">{formatTimestamp(node.at).rel}</span>
                  </span>
                  {node.txHash && node.kind !== 'complete' && (
                    <a
                      href={xLayerExplorerTx(node.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                    >
                      receipt <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );

  if (bare) return body;

  return (
    <CompactCard variant="glass" padding="lg" hover={false} className="hud border-cyan-400/15">
      {body}
    </CompactCard>
  );
}
