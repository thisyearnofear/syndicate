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

import { useEffect, useState } from 'react';
import { OperatorTaskRow } from './TaskRow';

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
  /** Keeper tool that performed the step (float-check, buyTickets, verify…). */
  toolId?: string | null;
  txHash?: string | null;
  chain?: string | null;
  at: number;
}

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

function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);
  return active ? elapsed : 0;
}

export function OperatorRunTimeline({
  entries,
  explorerTx,
  emptyMessage = 'No operator run recorded yet.',
  loading = false,
}: {
  entries: OperatorReplayEntry[];
  /** Receives the node's chain tag when present; single-arg callers ignore it. */
  explorerTx: (hash: string, chain?: string | null) => string;
  emptyMessage?: string;
  /** When true and empty, show elapsed-aware journal read instead of a skeleton. */
  loading?: boolean;
}) {
  const nodes = toOperatorTimeline(entries);
  const elapsed = useElapsedSeconds(loading && nodes.length === 0);

  if (nodes.length === 0) {
    if (loading) {
      return (
        <p className="py-6 text-center font-mono text-sm text-gray-500">
          Reading keeper journal… {elapsed}s
        </p>
      );
    }
    return (
      <p className="py-6 text-center text-sm text-gray-500">{emptyMessage}</p>
    );
  }

  return (
    <ol
      className="relative space-y-4"
      aria-label="Operator run timeline"
      data-operator-run-count={nodes.length}
    >
      {/* The spine */}
      <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-px bg-white/10" />
      {nodes.map((node) => (
        <OperatorTaskRow key={node.id} node={node} explorerTx={explorerTx} />
      ))}
    </ol>
  );
}

export default OperatorRunTimeline;
