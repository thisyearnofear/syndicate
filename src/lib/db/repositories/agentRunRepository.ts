/**
 * AGENT RUN REPOSITORY
 *
 * Server-side persistence for agent loop transitions written by the
 * X Layer keeper cron. Powers the public "latest operator run" replay
 * on /xlayer so judges and strangers can audit the agent without
 * connecting a wallet or running the loop themselves.
 *
 * Runtime code must not create tables — schema lives in
 * src/lib/db/migrations/016-add-agent-run-events.sql.
 */

import { sql } from '@vercel/postgres';
import { assertTableExists } from '../assertTable';

export type AgentRunKind =
  | 'plan'
  | 'plan_failed'
  | 'approve'
  | 'reject'
  | 'execute'
  | 'complete'
  | 'fail'
  | 'reset';

export interface AgentRunEvent {
  id: string;
  sessionId: string;
  kind: AgentRunKind;
  label: string;
  detail?: string | null;
  toolId?: string | null;
  txHash?: string | null;
  source?: string | null;
  createdAt: number;
}

export async function ensureAgentRunEventsTable(): Promise<void> {
  await assertTableExists('agent_run_events');
}

export async function appendAgentRunEvent(event: AgentRunEvent): Promise<void> {
  await sql`
    INSERT INTO agent_run_events (id, session_id, kind, label, detail, tool_id, tx_hash, source, created_at)
    VALUES (
      ${event.id},
      ${event.sessionId},
      ${event.kind},
      ${event.label},
      ${event.detail ?? null},
      ${event.toolId ?? null},
      ${event.txHash ?? null},
      ${event.source ?? null},
      ${event.createdAt}
    );
  `;
}

/**
 * The most recent session and its entries, oldest-first for replay.
 * Returns null when no operator run has ever been recorded.
 */
export async function getLatestAgentRunSession(): Promise<{
  sessionId: string;
  entries: AgentRunEvent[];
} | null> {
  return getLatestAgentRunSessionBySource(null);
}

/**
 * Same as getLatestAgentRunSession, restricted to one event source
 * (e.g. 'season-keeper' vs the X Layer keeper). Pass null for any source.
 */
export async function getLatestAgentRunSessionBySource(source: string | null): Promise<{
  sessionId: string;
  entries: AgentRunEvent[];
} | null> {
  const latest = source
    ? await sql`
        SELECT session_id
        FROM agent_run_events
        WHERE source = ${source}
        ORDER BY created_at DESC
        LIMIT 1;
      `
    : await sql`
        SELECT session_id
        FROM agent_run_events
        ORDER BY created_at DESC
        LIMIT 1;
      `;
  if (latest.rows.length === 0) return null;

  const sessionId = latest.rows[0].session_id as string;
  const result = await sql`
    SELECT id, session_id, kind, label, detail, tool_id, tx_hash, source, created_at
    FROM agent_run_events
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC;
  `;

  return {
    sessionId,
    entries: result.rows.map((row) => ({
      id: row.id as string,
      sessionId: row.session_id as string,
      kind: row.kind as AgentRunKind,
      label: row.label as string,
      detail: row.detail as string | null,
      toolId: row.tool_id as string | null,
      txHash: row.tx_hash as string | null,
      source: row.source as string | null,
      createdAt: Number(row.created_at),
    })),
  };
}
