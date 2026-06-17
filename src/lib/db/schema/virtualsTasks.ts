/**
 * VIRTUALS AGENT TASKS DATABASE SCHEMA
 *
 * Core Principles Applied:
 * - ORGANIZED: Centralized schema for Virtuals ACP automation
 * - CLEAN: Type-safe schema definitions, consistent with gelato/purchase patterns
 * - PERFORMANT: Indexed queries for status monitoring and due-task drain
 *
 * Stores Virtuals ACP autonomous agent task metadata for:
 * - Task lifecycle management (active/paused/cancelled)
 * - Cron-driven execution (next_execution_at)
 * - Execution history (last_reasoning, last_tx_hash, last_error)
 * - Kill switch (is_active flag honored by the cron)
 *
 * Backed by Vercel Postgres in production. The repository implementation
 * (virtualsTaskRepository.ts) is the only file that imports from @vercel/postgres.
 */

import { Address } from 'viem';

// =============================================================================
// TYPES
// =============================================================================

export type VirtualsTaskFrequency = 'hourly' | 'daily' | 'weekly' | 'opportunistic';
export type VirtualsTaskStatus = 'active' | 'paused' | 'cancelled' | 'failed';

/**
 * Stored Virtuals task record.
 *
 * Represents a user's persistent request that the Syndicate Strategist agent
 * (Virtuals ACP) review and possibly act on a recurring basis. The cron
 * picks up tasks where `is_active = true AND next_execution_at <= NOW()`.
 */
export interface VirtualsTaskRecord {
  // Primary identifiers
  id: string; // Local task ID (uuid)
  agentId: string; // Virtuals agent ID (e.g. the Syndicate Strategist ID)
  userAddress: Address; // User's wallet address

  // Task configuration
  frequency: VirtualsTaskFrequency;
  amount: bigint; // Stored as string in DB; human-readable USDC, e.g. "10"
  tokenSymbol: string; // "USDC", "USD₮", etc.
  recipientEmail: string; // Where the agent sends its post-execution report
  status: VirtualsTaskStatus;

  // Execution tracking
  executionCount: number;
  lastExecutedAt?: number; // Unix ms
  nextExecutionAt: number; // Unix ms
  lastReasoning?: string; // Most recent Venice AI reasoning string
  lastTxHash?: string; // Most recent on-chain tx hash
  lastError?: string;

  // Kill switch + metadata
  isActive: boolean; // Honored by the cron as a hard kill switch
  createdAt: number; // Unix ms
  updatedAt: number; // Unix ms
}

// =============================================================================
// CONVERSION HELPERS
// =============================================================================

/**
 * Convert bigint to string for storage.
 */
export function serializeVirtualsTask(
  task: Omit<VirtualsTaskRecord, 'amount'> & { amount: bigint }
): Omit<VirtualsTaskRecord, 'amount'> & { amount: string } {
  return { ...task, amount: task.amount.toString() } as Omit<VirtualsTaskRecord, 'amount'> & { amount: string };
}

/**
 * Convert string to bigint from storage.
 */
export function deserializeVirtualsTask(task: VirtualsTaskRecord & { amount: string }): VirtualsTaskRecord {
  return { ...task, amount: BigInt(task.amount) };
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface IVirtualsTaskRepository {
  createTask(task: VirtualsTaskRecord): Promise<VirtualsTaskRecord>;
  getTask(id: string): Promise<VirtualsTaskRecord | null>;
  getTasksByUserAddress(userAddress: string): Promise<VirtualsTaskRecord[]>;
  getTasksByAgentId(agentId: string): Promise<VirtualsTaskRecord[]>;
  updateTask(id: string, updates: Partial<VirtualsTaskRecord>): Promise<VirtualsTaskRecord>;
  deleteTask(id: string): Promise<boolean>;

  // Cron drain: tasks that are active and due right now
  getTasksDueForExecution(now: number, limit?: number): Promise<VirtualsTaskRecord[]>;

  // Kill switch: flip is_active to false everywhere for an agent
  deactivateAllForAgent(agentId: string): Promise<number>;
}

// =============================================================================
// IN-MEMORY MOCK (for tests / dev without Vercel Postgres)
// =============================================================================

export class MockVirtualsTaskRepository implements IVirtualsTaskRepository {
  private tasks = new Map<string, VirtualsTaskRecord>();

  async createTask(task: VirtualsTaskRecord): Promise<VirtualsTaskRecord> {
    this.tasks.set(task.id, task);
    return task;
  }

  async getTask(id: string): Promise<VirtualsTaskRecord | null> {
    return this.tasks.get(id) ?? null;
  }

  async getTasksByUserAddress(userAddress: string): Promise<VirtualsTaskRecord[]> {
    return Array.from(this.tasks.values()).filter(t => t.userAddress.toLowerCase() === userAddress.toLowerCase());
  }

  async getTasksByAgentId(agentId: string): Promise<VirtualsTaskRecord[]> {
    return Array.from(this.tasks.values()).filter(t => t.agentId === agentId);
  }

  async updateTask(id: string, updates: Partial<VirtualsTaskRecord>): Promise<VirtualsTaskRecord> {
    const task = this.tasks.get(id);
    if (!task) throw new Error('Virtuals task not found');
    const updated = { ...task, ...updates, updatedAt: Date.now() };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async getTasksDueForExecution(now: number, limit = 10): Promise<VirtualsTaskRecord[]> {
    return Array.from(this.tasks.values())
      .filter(t => t.isActive && t.status === 'active' && t.nextExecutionAt <= now)
      .sort((a, b) => a.nextExecutionAt - b.nextExecutionAt)
      .slice(0, limit);
  }

  async deactivateAllForAgent(agentId: string): Promise<number> {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.agentId === agentId && task.isActive) {
        task.isActive = false;
        task.status = 'cancelled';
        task.updatedAt = Date.now();
        count++;
      }
    }
    return count;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let repositoryInstance: IVirtualsTaskRepository | null = null;

export function getVirtualsTaskRepository(): IVirtualsTaskRepository {
  if (!repositoryInstance) {
    // In production we use VercelPostgresVirtualsTaskRepository; tests inject
    // a mock via setVirtualsTaskRepository.
    repositoryInstance = new MockVirtualsTaskRepository();
  }
  return repositoryInstance;
}

export function setVirtualsTaskRepository(repo: IVirtualsTaskRepository): void {
  repositoryInstance = repo;
}
