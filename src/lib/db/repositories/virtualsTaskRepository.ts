/**
 * VERCEL POSTGRES VIRTUALS TASK REPOSITORY
 *
 * Implements IVirtualsTaskRepository using @vercel/postgres.
 * Production-ready database layer for Virtuals ACP automation.
 *
 * The schema is bootstrapped idempotently via ensureVirtualsTasksTable()
 * which is safe to call on every cold start.
 */

import { sql } from '@vercel/postgres';
import {
  VirtualsTaskRecord,
  IVirtualsTaskRepository,
} from '../schema/virtualsTasks';

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

export async function ensureVirtualsTasksTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS virtuals_tasks (
      id                UUID PRIMARY KEY,
      agent_id          TEXT        NOT NULL,
      user_address      VARCHAR(42) NOT NULL,
      frequency         TEXT        NOT NULL,
      amount            NUMERIC(78) NOT NULL,
      token_symbol      TEXT        NOT NULL,
      recipient_email   TEXT        NOT NULL,
      status            TEXT        NOT NULL DEFAULT 'active',
      execution_count   INTEGER     NOT NULL DEFAULT 0,
      last_executed_at  BIGINT,
      next_execution_at BIGINT      NOT NULL,
      last_reasoning    TEXT,
      last_tx_hash      VARCHAR(66),
      last_error        TEXT,
      is_active         BOOLEAN     NOT NULL DEFAULT true,
      created_at        BIGINT      NOT NULL,
      updated_at        BIGINT      NOT NULL
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_virtuals_tasks_due
      ON virtuals_tasks (next_execution_at)
      WHERE is_active = true AND status = 'active';
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_virtuals_tasks_agent_user
      ON virtuals_tasks (agent_id, user_address);
  `;
}

// ---------------------------------------------------------------------------
// VercelPostgresVirtualsTaskRepository
// ---------------------------------------------------------------------------

export class VercelPostgresVirtualsTaskRepository implements IVirtualsTaskRepository {
  async createTask(task: VirtualsTaskRecord): Promise<VirtualsTaskRecord> {
    const result = await sql`
      INSERT INTO virtuals_tasks (
        id, agent_id, user_address, frequency, amount, token_symbol,
        recipient_email, status, execution_count, next_execution_at,
        is_active, created_at, updated_at
      )
      VALUES (
        ${task.id}, ${task.agentId}, ${task.userAddress}, ${task.frequency},
        ${task.amount.toString()}, ${task.tokenSymbol}, ${task.recipientEmail},
        ${task.status}, ${task.executionCount}, ${task.nextExecutionAt},
        ${task.isActive}, ${task.createdAt}, ${task.updatedAt}
      )
      RETURNING *;
    `;
    return this.mapRowToTask(result.rows[0]);
  }

  async getTask(id: string): Promise<VirtualsTaskRecord | null> {
    const result = await sql`SELECT * FROM virtuals_tasks WHERE id = ${id} LIMIT 1;`;
    return result.rows.length ? this.mapRowToTask(result.rows[0]) : null;
  }

  async getTasksByUserAddress(userAddress: string): Promise<VirtualsTaskRecord[]> {
    const result = await sql`
      SELECT * FROM virtuals_tasks
      WHERE LOWER(user_address) = LOWER(${userAddress})
      ORDER BY created_at DESC;
    `;
    return result.rows.map(row => this.mapRowToTask(row));
  }

  async getTasksByAgentId(agentId: string): Promise<VirtualsTaskRecord[]> {
    const result = await sql`
      SELECT * FROM virtuals_tasks
      WHERE agent_id = ${agentId}
      ORDER BY created_at DESC;
    `;
    return result.rows.map(row => this.mapRowToTask(row));
  }

  async updateTask(id: string, updates: Partial<VirtualsTaskRecord>): Promise<VirtualsTaskRecord> {
    const now = Date.now();

    const setters: string[] = ['updated_at = $1'];
    const values: unknown[] = [now];
    let i = 2;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id' || key === 'agentId') continue; // immutable
      if (value === undefined) continue;

      if (key === 'amount' && typeof value === 'bigint') {
        setters.push(`amount = $${i++}`);
        values.push(value.toString());
      } else {
        setters.push(`${this.camelToSnake(key)} = $${i++}`);
        values.push(value);
      }
    }

    values.push(id);
    const query = `UPDATE virtuals_tasks SET ${setters.join(', ')} WHERE id = $${i} RETURNING *;`;
    const result = await sql.query(query, values);

    if (!result.rows.length) throw new Error('Virtuals task not found');
    return this.mapRowToTask(result.rows[0]);
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await sql`DELETE FROM virtuals_tasks WHERE id = ${id};`;
    return (result.rowCount ?? 0) > 0;
  }

  async getTasksDueForExecution(now: number, limit = 10): Promise<VirtualsTaskRecord[]> {
    const result = await sql`
      SELECT * FROM virtuals_tasks
      WHERE is_active = true
        AND status = 'active'
        AND next_execution_at <= ${now}
      ORDER BY next_execution_at ASC
      LIMIT ${limit};
    `;
    return result.rows.map(row => this.mapRowToTask(row));
  }

  async deactivateAllForAgent(agentId: string): Promise<number> {
    const result = await sql`
      UPDATE virtuals_tasks
      SET is_active = false, status = 'cancelled', updated_at = ${Date.now()}
      WHERE agent_id = ${agentId} AND is_active = true;
    `;
    return result.rowCount ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapRowToTask(row: Record<string, unknown>): VirtualsTaskRecord {
    return {
      id: row.id as string,
      agentId: row.agent_id as string,
      userAddress: row.user_address as `0x${string}`,
      frequency: row.frequency as VirtualsTaskRecord['frequency'],
      amount: BigInt(row.amount as string),
      tokenSymbol: row.token_symbol as string,
      recipientEmail: row.recipient_email as string,
      status: row.status as VirtualsTaskRecord['status'],
      executionCount: row.execution_count as number,
      lastExecutedAt: row.last_executed_at != null ? Number(row.last_executed_at) : undefined,
      nextExecutionAt: Number(row.next_execution_at),
      lastReasoning: row.last_reasoning as string | undefined,
      lastTxHash: row.last_tx_hash as string | undefined,
      lastError: row.last_error as string | undefined,
      isActive: row.is_active as boolean,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
