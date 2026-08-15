'use client';

/**
 * AGENT SESSION TRANSCRIPT — the judge-visible audit view of the agent loop.
 *
 * Renders the persisted transition ring (plan, HITL approve/reject,
 * execute, complete/fail) in reverse-chronological order with kind
 * badges, session ids, and block-explorer links for receipts. Every
 * entry was also emitted as an agent.* lifecycle event, so logger +
 * analytics see the same stream.
 *
 * Honesty notes shown up front: demo oracle disclosed, write gate,
 * HITL enforced, receipts required. The transcript proves them.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, FileText } from "lucide-react";
import {
  agentSessionTranscript,
  AGENT_TRANSCRIPT_EVENT,
  type AgentTranscriptEntry,
  type AgentTranscriptKind,
} from "@/services/agents/transcript/agentSessionTranscript";
import { xLayerExplorerTx } from "@/config/xlayer";

const KIND_STYLE: Record<AgentTranscriptKind, string> = {
  plan: 'bg-cyan-500/15 text-cyan-200',
  plan_failed: 'bg-rose-500/20 text-rose-200',
  approve: 'bg-cyan-500/20 text-cyan-200',
  reject: 'bg-rose-500/20 text-rose-200',
  execute: 'bg-amber-500/20 text-amber-200',
  complete: 'bg-emerald-500/20 text-emerald-200',
  fail: 'bg-rose-500/20 text-rose-200',
  reset: 'bg-white/10 text-slate-300',
};

const KIND_LABEL: Record<AgentTranscriptKind, string> = {
  plan: 'plan',
  plan_failed: 'plan failed',
  approve: 'hitl: approved',
  reject: 'hitl: rejected',
  execute: 'executing',
  complete: 'completed',
  fail: 'failed',
  reset: 'reset',
};

/** Plain-text export — pasteable into the hackathon form or judge Q&A. */
function toPlainText(entries: AgentTranscriptEntry[]): string {
  return entries
    .map((e) => {
      const time = new Date(e.at).toISOString();
      const parts = [
        `[${time}]`,
        KIND_LABEL[e.kind],
        `— ${e.label}`,
        e.detail ? `(${e.detail})` : null,
        e.txHash ? `receipt: ${e.txHash}` : null,
        e.source ? `planner: ${e.source}` : null,
      ];
      return parts.filter(Boolean).join(' ');
    })
    .join('\n');
}

export function AgentSessionTranscript({ currentSessionId }: { currentSessionId?: string }) {
  const [entries, setEntries] = useState<AgentTranscriptEntry[]>([]);
  const [sessionScope, setSessionScope] = useState<'all' | 'current'>('all');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = () => setEntries(agentSessionTranscript.getEntries());
    load();
    window.addEventListener(AGENT_TRANSCRIPT_EVENT, load);
    return () => window.removeEventListener(AGENT_TRANSCRIPT_EVENT, load);
  }, []);

  const sessionIds = useMemo(
    () => [...new Set(entries.map((e) => e.sessionId))],
    [entries],
  );

  const filtered = useMemo(() => {
    if (sessionScope === 'current' && currentSessionId) {
      return entries.filter((e) => e.sessionId === currentSessionId);
    }
    return entries;
  }, [entries, sessionScope, currentSessionId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(filtered));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions, insecure context) — leave state as-is.
    }
  };

  if (entries.length === 0) {
    return (
      <p className="hud rounded-xl p-4 font-mono text-sm text-slate-400">
        No transcript yet — run <span className="font-medium text-white">Plan next actions</span> and the full
        plan / HITL / execution trail appears here, persisted across refreshes.
      </p>
    );
  }

  return (
    <div className="hud overflow-hidden rounded-xl font-mono">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
          <FileText className="h-3.5 w-3.5" />
          Transcript ({filtered.length})
        </p>
        <div className="flex items-center gap-2">
          {currentSessionId && sessionIds.length > 1 && (
            <div className="flex rounded-full border border-white/10 p-0.5">
              {(['all', 'current'] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => setSessionScope(scope)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors touch-manipulation ${
                    sessionScope === scope ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {scope === 'all' ? `All (${entries.length})` : 'This session'}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:border-white/20 transition-colors touch-manipulation"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={() => agentSessionTranscript.clear()}
            className="text-xs text-slate-500 hover:text-white transition-colors touch-manipulation"
          >
            Clear
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No entries in this session yet.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-white/5 overflow-y-auto">
          {filtered.map((entry) => (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${KIND_STYLE[entry.kind]}`}>
                    {KIND_LABEL[entry.kind]}
                  </span>
                  <span className="truncate text-sm text-white">{entry.label}</span>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">
                  {new Date(entry.at).toLocaleTimeString()}
                </span>
              </div>
              {entry.detail && (
                <p className="mt-1 text-xs text-slate-400">{entry.detail}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                <span>session …{entry.sessionId.slice(-6)}</span>
                {entry.source && <span>planner: {entry.source}</span>}
                {entry.txHash && (
                  <a
                    href={xLayerExplorerTx(entry.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                  >
                    receipt {entry.txHash.slice(0, 8)}…
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
