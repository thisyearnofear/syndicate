'use client';

/**
 * OPERATOR RUN TIMELINE — the shared grammar for public keeper replays.
 *
 * One component renders every keeper's run (Agent Pool, Season, Stacks
 * settlement) so the proof story reads identically across worlds:
 * execute+complete/fail pairs collapse into single action nodes on a spine,
 * every completed action carries its explorer receipt, and plan/terminal
 * kinds map to one dot vocabulary. Data is agent_run_events — persisted
 * server-side, replayable with no wallet. This is the "every claim carries
 * a receipt" contract, rendered.
 *
 * The accent is intentionally neutral (infra stays quiet, docs/DESIGN.md):
 * each operator panel adds its own world's badge above the timeline.
 */

import { ExternalLink } from 'lucide-react';

export interface OperatorReplayEntry {
  id: string;
  kind: string;
  label: string;
  detail?: string | null;
  toolId?: string | null;
  txHash?: string | null;
  source?: string | null;
  /** Chain the txHash lives on (e.g. 'base', 'xlayer'); drives explorer routing. */
  chain?: string | null;
  createdAt: number;
}

export interface OperatorTimelineNode {
  id: string;
  kind: 'plan' | 'plan_failed' | 'complete' | 'fail';
  label: string;
  detail?: string | null;
  txHash?: string | null;
  chain?: string | null;
  at: number;
}

const DOT_STYLE: Record<OperatorTimelineNode['kind'], string> = {
  plan: 'bg-slate-400 w-2.5 h-2.5',
  plan_failed: 'bg-rose-400 w-2.5 h-2.5',
  complete: 'bg-emerald-400 w-3.5 h-3.5',
  fail: 'bg-rose-400 w-2.5 h-2.5',
};

const KIND_LABEL: Record<OperatorTimelineNode['kind'], string> = {
  plan: 'plan',
  plan_failed: 'plan failed',
  complete: 'on-chain ✓',
  fail: 'failed',
};

/** Collapse an execute + its terminal complete/fail into one action node. */
export function toOperatorTimeline(entries: OperatorReplayEntry[]): OperatorTimelineNode[] {
  const nodes: OperatorTimelineNode[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.kind === 'execute') {
      const next = entries[i + 1];
      if (next && (next.kind === 'complete' || next.kind === 'fail') && next.label === e.label) {
        nodes.push({
          id: next.id,
          kind: next.kind as 'complete' | 'fail',
          label: e.label,
          detail: next.detail ?? e.detail ?? null,
          txHash: next.txHash ?? e.txHash ?? null,
          chain: next.chain ?? e.chain ?? null,
          at: next.createdAt,
        });
        i++; // consume the terminal pair
        continue;
      }
      // Unpaired execute (still running or interrupted) — show as pending.
      nodes.push({
        id: e.id,
        kind: 'plan',
        label: e.label,
        detail: e.detail ?? null,
        txHash: e.txHash ?? null,
        chain: e.chain ?? null,
        at: e.createdAt,
      });
      continue;
    }
    if (e.kind === 'plan' || e.kind === 'plan_failed' || e.kind === 'complete' || e.kind === 'fail') {
      // Skip terminals already paired; keep standalone ones.
      nodes.push({
        id: e.id,
        kind: e.kind as OperatorTimelineNode['kind'],
        label: e.label,
        detail: e.detail ?? null,
        txHash: e.txHash ?? null,
        chain: e.chain ?? null,
        at: e.createdAt,
      });
    }
  }
  return nodes;
}

function timeAgo(ts: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function OperatorRunTimeline({
  entries,
  explorerTx,
  emptyMessage = 'No operator run recorded yet.',
}: {
  entries: OperatorReplayEntry[];
  /** Receives the node's chain tag when present; single-arg callers ignore it. */
  explorerTx: (hash: string, chain?: string | null) => string;
  emptyMessage?: string;
}) {
  const nodes = toOperatorTimeline(entries);

  if (nodes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">{emptyMessage}</p>
    );
  }

  return (
    <ol className="relative space-y-4" aria-label="Operator run timeline">
      {/* The spine */}
      <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-px bg-white/10" />
      {nodes.map((node) => (
        <li key={node.id} className="relative flex items-start gap-3 pl-1">
          <span
            aria-hidden
            className={`mt-1.5 shrink-0 rounded-full ${DOT_STYLE[node.kind]}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium text-gray-200">{node.label}</p>
              <time className="shrink-0 text-[11px] text-gray-500" dateTime={new Date(node.at).toISOString()}>
                {timeAgo(node.at)}
              </time>
            </div>
            {node.detail && (
              <p className="mt-0.5 break-words text-xs text-gray-500">{node.detail}</p>
            )}
            <div className="mt-1 flex items-center gap-3">
              <span
                className={`text-[11px] font-medium ${
                  node.kind === 'complete'
                    ? 'text-emerald-400'
                    : node.kind === 'fail' || node.kind === 'plan_failed'
                      ? 'text-rose-400'
                      : 'text-gray-500'
                }`}
              >
                {KIND_LABEL[node.kind]}
              </span>
              {node.txHash && (
                <a
                  href={explorerTx(node.txHash, node.chain)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-400 underline-offset-2 hover:text-white hover:underline"
                >
                  {node.txHash.slice(0, 10)}…{node.txHash.slice(-6)}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default OperatorRunTimeline;
