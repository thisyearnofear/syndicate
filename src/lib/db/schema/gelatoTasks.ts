/**
 * GELATO TASKS DATABASE SCHEMA
 *
 * Core Principles Applied:
 * - ORGANIZED: Centralized schema for database operations
 * - CLEAN: Type-safe schema definitions
 * - PERFORMANT: Indexed queries for status monitoring
 *
 * Stores Gelato automation task metadata for:
 * - Task lifecycle management (create, pause, resume, cancel)
 * - Execution history and monitoring
 * - Permission tracking and validation
 *
 * For production, integrate with your DB (Supabase, MongoDB, etc)
 */

import { Address } from 'viem';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Stored Gelato task record
 */
export interface GelatoTaskRecord {
  // Primary identifiers
  id: string; // Local task ID (uuid)
  taskId: string; // Gelato task ID from API
  userId: string; // User ID from auth session

  // Task configuration
  permissionId: string; // Links to ERC-7715 permission
  userAddress: Address; // User's wallet address
  frequency: 'daily' | 'weekly' | 'monthly';
  amountPerPeriod: bigint; // Stored as string in DB
  status: 'active' | 'paused' | 'cancelled';

  // Execution tracking
  executionCount: number;
  lastExecutedAt?: number; // Unix timestamp
  nextExecutionTime: number; // Unix timestamp
  lastError?: string;

  // Metadata
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  expiresAt?: number; // When permission expires

  // Gelato status
  gelatoStatus?: 'active' | 'paused' | 'cancelled';
}

/**
 * Gelato execution history record
 */
export interface GelatoExecutionRecord {
  id: string; // uuid
  taskId: string; // Foreign key to GelatoTaskRecord
  taskRecordId: string; // Local task ID
  userId: string;

  // Execution details
  executedAt: number; // Unix timestamp
  transactionHash?: string;
  success: boolean;
  error?: string;

  // Amount executed
  amountExecuted: bigint; // Stored as string
  referrer: Address;

  // Gelato metadata
  gelatoExecutionId?: string;
  gasUsed?: bigint;

  createdAt: number;
}

// =============================================================================
// CONVERSION HELPERS
// =============================================================================

/**
 * Convert bigint to string for storage
 */
export function serializeGelatoTask(
  task: Omit<GelatoTaskRecord, 'amountPerPeriod'> & { amountPerPeriod: bigint }
): Omit<GelatoTaskRecord, 'amountPerPeriod'> & { amountPerPeriod: string } {
  return {
    ...task,
    amountPerPeriod: task.amountPerPeriod.toString(),
  } as any;
}

/**
 * Convert string to bigint from storage
 */
export function deserializeGelatoTask(task: GelatoTaskRecord & { amountPerPeriod: string }): GelatoTaskRecord {
  return {
    ...task,
    amountPerPeriod: BigInt(task.amountPerPeriod),
  };
}

// =============================================================================
// SUPABASE SCHEMA (Reference)
// =============================================================================

/**
 * SQL for creating tables in Supabase PostgreSQL:
 *
 * -- Gelato Tasks Table
 * CREATE TABLE gelato_tasks (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   task_id VARCHAR(255) NOT NULL UNIQUE,
 *   user_id VARCHAR(255) NOT NULL,
 *   permission_id VARCHAR(255) NOT NULL,
 *   user_address VARCHAR(42) NOT NULL,
 *   frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
 *   amount_per_period NUMERIC(78) NOT NULL,
 *   status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'paused', 'cancelled')),
 *   execution_count INTEGER DEFAULT 0,
 *   last_executed_at BIGINT,
 *   next_execution_time BIGINT NOT NULL,
 *   last_error TEXT,
 *   gelato_status VARCHAR(20),
 *   created_at BIGINT NOT NULL,
 *   updated_at BIGINT NOT NULL,
 *   expires_at BIGINT,
 *
 *   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
 *   INDEX idx_user_id (user_id),
 *   INDEX idx_task_id (task_id),
 *   INDEX idx_status (status),
 *   INDEX idx_next_execution (next_execution_time)
 * );
 *
 * -- Gelato Execution History Table
 * CREATE TABLE gelato_executions (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   task_id VARCHAR(255) NOT NULL,
 *   task_record_id UUID NOT NULL,
 *   user_id VARCHAR(255) NOT NULL,
 *   executed_at BIGINT NOT NULL,
 *   transaction_hash VARCHAR(255),
 *   success BOOLEAN NOT NULL,
 *   error TEXT,
 *   amount_executed NUMERIC(78),
 *   referrer VARCHAR(42),
 *   gelato_execution_id VARCHAR(255),
 *   gas_used NUMERIC(78),
 *   created_at BIGINT NOT NULL,
 *
 *   FOREIGN KEY (task_record_id) REFERENCES gelato_tasks(id) ON DELETE CASCADE,
 *   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
 *   INDEX idx_task_record_id (task_record_id),
 *   INDEX idx_user_id (user_id),
 *   INDEX idx_executed_at (executed_at)
 * );
 */

// =============================================================================
// DATABASE OPERATIONS (Interface - implement in separate file)
// =============================================================================

/**
 * Interface for database operations
 * Implement with your chosen database (Supabase, MongoDB, etc)
 */
export interface IGelatoTaskRepository {
  // Task operations
  createTask(task: GelatoTaskRecord): Promise<GelatoTaskRecord>;
  getTask(taskId: string): Promise<GelatoTaskRecord | null>;
  getTaskByGelatoId(gelatoTaskId: string): Promise<GelatoTaskRecord | null>;
  getTasksByUserId(userId: string): Promise<GelatoTaskRecord[]>;
  getActiveTasks(): Promise<GelatoTaskRecord[]>;
  updateTask(id: string, updates: Partial<GelatoTaskRecord>): Promise<GelatoTaskRecord>;
  deleteTask(id: string): Promise<boolean>;

  // Execution history
  recordExecution(execution: GelatoExecutionRecord): Promise<GelatoExecutionRecord>;
  getExecutionHistory(taskId: string, limit?: number): Promise<GelatoExecutionRecord[]>;
  getLastExecution(taskId: string): Promise<GelatoExecutionRecord | null>;

  // Queries
  getTasksDueForExecution(now: number): Promise<GelatoTaskRecord[]>;
  getTasksByStatus(status: string): Promise<GelatoTaskRecord[]>;
  getTasksExpiringIn(days: number): Promise<GelatoTaskRecord[]>;
}

/**
 * Mock in-memory implementation for testing
 * Replace with real database implementation
 */
export class MockGelatoTaskRepository implements IGelatoTaskRepository {
  private tasks = new Map<string, GelatoTaskRecord>();
  private executions: GelatoExecutionRecord[] = [];

  async createTask(task: GelatoTaskRecord): Promise<GelatoTaskRecord> {
    this.tasks.set(task.id, task);
    return task;
  }

  async getTask(taskId: string): Promise<GelatoTaskRecord | null> {
    return this.tasks.get(taskId) || null;
  }

  async getTaskByGelatoId(gelatoTaskId: string): Promise<GelatoTaskRecord | null> {
    for (const task of this.tasks.values()) {
      if (task.taskId === gelatoTaskId) {
        return task;
      }
    }
    return null;
  }

  async getTasksByUserId(userId: string): Promise<GelatoTaskRecord[]> {
    return Array.from(this.tasks.values()).filter(t => t.userId === userId);
  }

  async getActiveTasks(): Promise<GelatoTaskRecord[]> {
    return Array.from(this.tasks.values()).filter(t => t.status === 'active');
  }

  async updateTask(id: string, updates: Partial<GelatoTaskRecord>): Promise<GelatoTaskRecord> {
    const task = this.tasks.get(id);
    if (!task) throw new Error('Task not found');

    const updated = { ...task, ...updates, updatedAt: Math.floor(Date.now() / 1000) };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async recordExecution(execution: GelatoExecutionRecord): Promise<GelatoExecutionRecord> {
    this.executions.push(execution);
    return execution;
  }

  async getExecutionHistory(taskId: string, limit = 10): Promise<GelatoExecutionRecord[]> {
    return this.executions
      .filter(e => e.taskId === taskId)
      .slice(-limit)
      .reverse();
  }

  async getLastExecution(taskId: string): Promise<GelatoExecutionRecord | null> {
    const executions = this.executions.filter(e => e.taskId === taskId);
    return executions[executions.length - 1] || null;
  }

  async getTasksDueForExecution(now: number): Promise<GelatoTaskRecord[]> {
    return Array.from(this.tasks.values()).filter(
      t => t.status === 'active' && t.nextExecutionTime <= now
    );
  }

  async getTasksByStatus(status: string): Promise<GelatoTaskRecord[]> {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  async getTasksExpiringIn(days: number): Promise<GelatoTaskRecord[]> {
    const now = Math.floor(Date.now() / 1000);
    const expireWindow = days * 24 * 60 * 60;

    return Array.from(this.tasks.values()).filter(
      t => t.expiresAt && t.expiresAt > now && t.expiresAt <= now + expireWindow
    );
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let repositoryInstance: IGelatoTaskRepository | null = null;

export function getGelatoTaskRepository(): IGelatoTaskRepository {
  if (!repositoryInstance) {
    // For hackathon phase: use mock repository
    // In production: initialize with real DB (Supabase, etc)
    repositoryInstance = new MockGelatoTaskRepository();
    console.log('[GelatoTaskRepository] Using mock in-memory repository. Replace with real DB in production.');
  }
  return repositoryInstance;
}

export function setGelatoTaskRepository(repo: IGelatoTaskRepository): void {
  repositoryInstance = repo;
}

// =============================================================================
// PRODUCTION INITIALIZATION
// =============================================================================

/**
 * Initialize production Postgres repository (Vercel Postgres, Neon, etc)
 * Call this in your app initialization (e.g., middleware or server startup)
 */
export async function initializeProductionRepository(): Promise<void> {
  // Support multiple Postgres providers
  const hasDbConnection = 
    process.env.POSTGRES_URL || 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URLCONNECTION_STRING;

  if (hasDbConnection) {
    try {
      const { VercelPostgresGelatoRepository } = await import('../repositories/gelatoRepository');
      repositoryInstance = new VercelPostgresGelatoRepository();
      const provider = process.env.POSTGRES_URL ? 'Neon' : 'Vercel Postgres';
      console.log(`[GelatoTaskRepository] Initialized with ${provider}`);
    } catch (error) {
      console.error('[GelatoTaskRepository] Failed to initialize Postgres:', error);
      console.log('[GelatoTaskRepository] Falling back to mock repository');
      repositoryInstance = new MockGelatoTaskRepository();
    }
  }
}
