/**
 * VERCEL POSTGRES GELATO TASK REPOSITORY
 * 
 * Implements IGelatoTaskRepository using @vercel/postgres
 * Production-ready database layer for Gelato automation
 */

import { sql } from '@vercel/postgres';
import {
  GelatoTaskRecord,
  GelatoExecutionRecord,
  IGelatoTaskRepository,
  serializeGelatoTask,
  deserializeGelatoTask,
} from '../schema/gelatoTasks';

export class VercelPostgresGelatoRepository implements IGelatoTaskRepository {
  // =============================================================================
  // TASK OPERATIONS
  // =============================================================================

  async createTask(task: GelatoTaskRecord): Promise<GelatoTaskRecord> {
    const result = await sql`
      INSERT INTO gelato_tasks (
        id, task_id, user_id, permission_id, user_address, frequency,
        amount_per_period, status, execution_count, next_execution_time,
        created_at, updated_at
      )
      VALUES (
        ${task.id}, ${task.taskId}, ${task.userId}, ${task.permissionId},
        ${task.userAddress}, ${task.frequency}, ${task.amountPerPeriod.toString()},
        ${task.status}, ${task.executionCount}, ${task.nextExecutionTime},
        ${task.createdAt}, ${task.updatedAt}
      )
      RETURNING *
    `;

    return this.mapRowToTask(result.rows[0]);
  }

  async getTask(taskId: string): Promise<GelatoTaskRecord | null> {
    const result = await sql`
      SELECT * FROM gelato_tasks WHERE id = ${taskId}
    `;

    return result.rows.length ? this.mapRowToTask(result.rows[0]) : null;
  }

  async getTaskByGelatoId(gelatoTaskId: string): Promise<GelatoTaskRecord | null> {
    const result = await sql`
      SELECT * FROM gelato_tasks WHERE task_id = ${gelatoTaskId}
    `;

    return result.rows.length ? this.mapRowToTask(result.rows[0]) : null;
  }

  async getTasksByUserId(userId: string): Promise<GelatoTaskRecord[]> {
    const result = await sql`
      SELECT * FROM gelato_tasks WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return result.rows.map(row => this.mapRowToTask(row));
  }

  async getActiveTasks(): Promise<GelatoTaskRecord[]> {
    const result = await sql`
      SELECT * FROM gelato_tasks WHERE status = 'active'
      ORDER BY next_execution_time ASC
    `;

    return result.rows.map(row => this.mapRowToTask(row));
  }

  async updateTask(id: string, updates: Partial<GelatoTaskRecord>): Promise<GelatoTaskRecord> {
    const now = Math.floor(Date.now() / 1000);

    // Build dynamic SET clause
    const setters: string[] = ['updated_at = ' + now];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id' || key === 'taskId') continue; // Skip immutable fields
      if (value === undefined) continue;

      if (key === 'amountPerPeriod' && typeof value === 'bigint') {
        setters.push(`${this.camelToSnake(key)} = $${values.length + 1}`);
        values.push(value.toString());
      } else {
        setters.push(`${this.camelToSnake(key)} = $${values.length + 1}`);
        values.push(value);
      }
    }

    const query = `
      UPDATE gelato_tasks
      SET ${setters.join(', ')}
      WHERE id = $${values.length + 1}
      RETURNING *
    `;

    values.push(id);
    const result = await sql.query(query, values);

    if (!result.rows.length) throw new Error('Task not found');
    return this.mapRowToTask(result.rows[0]);
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await sql`
      DELETE FROM gelato_tasks WHERE id = ${id}
    `;

    return result.rowCount > 0;
  }

  // =============================================================================
  // EXECUTION HISTORY
  // =============================================================================

  async recordExecution(execution: GelatoExecutionRecord): Promise<GelatoExecutionRecord> {
    const result = await sql`
      INSERT INTO gelato_executions (
        id, task_id, task_record_id, user_id, executed_at, transaction_hash,
        success, error, amount_executed, referrer, gelato_execution_id, gas_used, created_at
      )
      VALUES (
        ${execution.id}, ${execution.taskId}, ${execution.taskRecordId},
        ${execution.userId}, ${execution.executedAt}, ${execution.transactionHash},
        ${execution.success}, ${execution.error}, ${execution.amountExecuted?.toString()},
        ${execution.referrer}, ${execution.gelatoExecutionId}, ${execution.gasUsed?.toString()},
        ${execution.createdAt}
      )
      RETURNING *
    `;

    return this.mapRowToExecution(result.rows[0]);
  }

  async getExecutionHistory(taskId: string, limit = 10): Promise<GelatoExecutionRecord[]> {
    const result = await sql`
      SELECT * FROM gelato_executions
      WHERE task_id = ${taskId}
      ORDER BY executed_at DESC
      LIMIT ${limit}
    `;

    return result.rows.map(row => this.mapRowToExecution(row));
  }

  async getLastExecution(taskId: string): Promise<GelatoExecutionRecord | null> {
    const result = await sql`
      SELECT * FROM gelato_executions
      WHERE task_id = ${taskId}
      ORDER BY executed_at DESC
      LIMIT 1
    `;

    return result.rows.length ? this.mapRowToExecution(result.rows[0]) : null;
  }

  // =============================================================================
  // QUERIES
  // =============================================================================

  async getTasksDueForExecution(now: number): Promise<GelatoTaskRecord[]> {
    const result = await sql`
      SELECT * FROM gelato_tasks
      WHERE status = 'active' AND next_execution_time <= ${now}
      ORDER BY next_execution_time ASC
    `;

    return result.rows.map(row => this.mapRowToTask(row));
  }

  async getTasksByStatus(status: string): Promise<GelatoTaskRecord[]> {
    const result = await sql`
      SELECT * FROM gelato_tasks WHERE status = ${status}
      ORDER BY created_at DESC
    `;

    return result.rows.map(row => this.mapRowToTask(row));
  }

  async getTasksExpiringIn(days: number): Promise<GelatoTaskRecord[]> {
    const now = Math.floor(Date.now() / 1000);
    const expireWindow = days * 24 * 60 * 60;

    const result = await sql`
      SELECT * FROM gelato_tasks
      WHERE expires_at IS NOT NULL
        AND expires_at > ${now}
        AND expires_at <= ${now + expireWindow}
      ORDER BY expires_at ASC
    `;

    return result.rows.map(row => this.mapRowToTask(row));
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private mapRowToTask(row: any): GelatoTaskRecord {
    return {
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      permissionId: row.permission_id,
      userAddress: row.user_address,
      frequency: row.frequency,
      amountPerPeriod: BigInt(row.amount_per_period),
      status: row.status,
      executionCount: row.execution_count,
      lastExecutedAt: row.last_executed_at,
      nextExecutionTime: row.next_execution_time,
      lastError: row.last_error,
      gelatoStatus: row.gelato_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
  }

  private mapRowToExecution(row: any): GelatoExecutionRecord {
    return {
      id: row.id,
      taskId: row.task_id,
      taskRecordId: row.task_record_id,
      userId: row.user_id,
      executedAt: row.executed_at,
      transactionHash: row.transaction_hash,
      success: row.success,
      error: row.error,
      amountExecuted: row.amount_executed ? BigInt(row.amount_executed) : undefined,
      referrer: row.referrer,
      gelatoExecutionId: row.gelato_execution_id,
      gasUsed: row.gas_used ? BigInt(row.gas_used) : undefined,
      createdAt: row.created_at,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
