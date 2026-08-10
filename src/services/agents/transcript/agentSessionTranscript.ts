/**
 * AGENT SESSION TRANSCRIPT — localStorage ring of agent-loop events.
 *
 * The agent loop in memory is judge-compelling but refresh-fragile;
 * this ring (mirroring yieldAutopilotExecutionLog's pattern) keeps the
 * last MAX_ENTRIES transitions per browser so the /xlayer panel can
 * show a full session transcript — plans, HITL decisions, executions,
 * receipts — across refreshes.
 *
 * Entries are metadata-only: no private keys, no permit payloads,
 * no plaintext balances. Client-side only; SSR returns [].
 */

import type { LifecycleEventName } from '@/services/observability/types';
import { emit } from '@/services/observability/emitter';
import type { AgentToolId } from '@/services/agents/tools/types';

const STORAGE_KEY = 'syndicate:agent-session-transcript';
export const AGENT_TRANSCRIPT_EVENT = 'syndicate:agent-transcript-updated';
const MAX_ENTRIES = 50;

export type AgentTranscriptKind =
  | 'plan'
  | 'plan_failed'
  | 'approve'
  | 'reject'
  | 'execute'
  | 'complete'
  | 'fail';

export interface AgentTranscriptEntry {
  id: string;
  at: number;
  sessionId: string;
  kind: AgentTranscriptKind;
  /** Human label, e.g. "Open draw" or "Plan created (heuristic)". */
  label: string;
  /** Supporting detail — args summary, decision, result message, error. */
  detail?: string;
  toolId?: AgentToolId;
  txHash?: string;
  source?: 'venice' | 'heuristic';
}

export interface AgentTranscriptEventOpts {
  sessionId: string;
  label: string;
  detail?: string;
  toolId?: AgentToolId;
  txHash?: string;
  source?: 'venice' | 'heuristic';
}

class AgentSessionTranscript {
  getEntries(): AgentTranscriptEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  append(kind: AgentTranscriptKind, opts: AgentTranscriptEventOpts): void {
    if (typeof window === 'undefined') return;
    const entries = this.getEntries();
    entries.unshift({
      id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      at: Date.now(),
      sessionId: opts.sessionId,
      kind,
      label: opts.label,
      detail: opts.detail,
      toolId: opts.toolId,
      txHash: opts.txHash,
      source: opts.source,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    window.dispatchEvent(new Event(AGENT_TRANSCRIPT_EVENT));
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(AGENT_TRANSCRIPT_EVENT));
  }
}

export const agentSessionTranscript = new AgentSessionTranscript();

// ─── Lifecycle emit + transcript persist in one call ────────────────────────

/**
 * Emit a structured agent.* lifecycle event AND persist a transcript
 * entry. Single call site in useAgentLoop keeps the observability graph
 * and the judge-visible transcript in lockstep.
 */
export function recordAgentTransition(
  eventName: Extract<
    LifecycleEventName,
    | 'agent.plan_created'
    | 'agent.plan_failed'
    | 'agent.step_approved'
    | 'agent.step_rejected'
    | 'agent.step_executed'
    | 'agent.step_completed'
    | 'agent.step_failed'
  >,
  kind: AgentTranscriptKind,
  opts: AgentTranscriptEventOpts & {
    chainId?: number;
    errorMessage?: string;
  },
): void {
  emit(eventName, {
    chain: 'xlayer',
    chainId: opts.chainId,
    operation: opts.toolId,
    transactionHash: opts.txHash,
    metadata: {
      sessionId: opts.sessionId,
      source: opts.source ?? null,
      detail: opts.detail ?? null,
    },
    ...(kind === 'fail' || kind === 'plan_failed'
      ? {
          error: {
            code: 'AGENT_ERROR',
            message: opts.errorMessage ?? 'Agent loop error',
            phase: kind,
            userCancelled: false,
          },
        }
      : {}),
  });

  agentSessionTranscript.append(kind, opts);
}
