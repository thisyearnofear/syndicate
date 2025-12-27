/**
 * PERMITTED TICKET EXECUTOR
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Adds automation layer to existing purchase logic
 * - DRY: Single service for all permitted executions
 * - CLEAN: Clear separation of automation concerns
 * - MODULAR: Composable execution strategy
 * - PERFORMANT: Caching, batching, and efficient scheduling
 * 
 * Executes automated ticket purchases when:
 * 1. User has granted Advanced Permissions to Syndicate
 * 2. Scheduled execution time arrives
 * 3. User's balance/allowance is sufficient
 * 4. No previous failed attempts in current window
 * 
 * Can be triggered by:
 * - Next.js API route (manual)
 * - Backend cron job (scheduled)
 * - Frontend automation hook (browser-based)
 */

import { megapotService } from '@/domains/lottery/services/megapotService';
import { advancedPermissionsService } from '@/domains/wallet/services/advancedPermissionsService';
import type { AutoPurchaseConfig } from '@/domains/wallet/types';
import type { PurchaseResult } from '@/domains/lottery/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * CLEAN: Represents execution state for scheduled purchase
 */
interface ExecutionState {
  userId: string;
  permissionId: string;
  lastExecutionTime: number;
  nextScheduledTime: number;
  executionCount: number;
  failureCount: number;
  lastError?: string;
}

/**
 * Result of attempting a scheduled execution
 */
interface ExecutionResult {
  success: boolean;
  userId: string;
  txHash?: string;
  nextScheduledTime?: number;
  error?: {
    code: string;
    message: string;
    isRetryable: boolean;
  };
}

// =============================================================================
// PERMITTED TICKET EXECUTOR SERVICE
// =============================================================================

class PermittedTicketExecutor {
  private executionStates = new Map<string, ExecutionState>();
  private readonly maxFailuresBeforePause = 3;
  private readonly failureResetWindowMs = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * MODULAR: Execute a scheduled permitted purchase
   * 
   * Checks:
   * - Is permission still valid?
   * - Is execution time reached?
   * - Is balance sufficient?
   * - Have we hit max failures?
   */
  async executeScheduledPurchase(config: AutoPurchaseConfig): Promise<ExecutionResult> {
    const userId = `user:${config.tokenAddress}`; // Placeholder - in production, use actual user ID
    const executionStateKey = `${userId}:${config.permission?.permissionId}`;

    try {
      // CLEAN: Check if execution is scheduled
      const state = this.executionStates.get(executionStateKey);
      const now = Date.now();

      if (state) {
        // Check if too many failures recently
        if (state.failureCount >= this.maxFailuresBeforePause) {
          const timeSinceLastFailure = now - state.lastExecutionTime;
          if (timeSinceLastFailure < this.failureResetWindowMs) {
            return {
              success: false,
              userId,
              error: {
                code: 'TOO_MANY_FAILURES',
                message: `Auto-purchase paused after ${state.failureCount} failures. Will retry in ${Math.ceil((this.failureResetWindowMs - timeSinceLastFailure) / 60000)} minutes.`,
                isRetryable: true,
              },
            };
          } else {
            // Reset failure counter if window has passed
            state.failureCount = 0;
          }
        }

        // Check if execution time has arrived
        if (now < state.nextScheduledTime) {
          return {
            success: false,
            userId,
            nextScheduledTime: state.nextScheduledTime,
            error: {
              code: 'NOT_YET_SCHEDULED',
              message: `Purchase scheduled for ${new Date(state.nextScheduledTime).toISOString()}`,
              isRetryable: false,
            },
          };
        }
      }

      // CLEAN: Verify permission is still active and valid
      if (!config.permission || !config.permission.isActive) {
        return {
          success: false,
          userId,
          error: {
            code: 'PERMISSION_INVALID',
            message: 'Advanced Permission is no longer valid or expired',
            isRetryable: false,
          },
        };
      }

      // Check if permission has sufficient remaining allowance
      if (config.permission.remaining < config.amountPerPeriod) {
        return {
          success: false,
          userId,
          error: {
            code: 'INSUFFICIENT_ALLOWANCE',
            message: `Permission has ${config.permission.remaining} remaining, but ${config.amountPerPeriod} required`,
            isRetryable: true,
          },
        };
      }

      // MODULAR: Execute the actual purchase
      const ticketCount = Number(config.amountPerPeriod / BigInt(10 ** 6)); // Convert USDC to ticket count
      const purchaseResult = await megapotService.executePurchaseWithPermission({
        userAddress: config.tokenAddress, // Placeholder
        permissionId: config.permission.permissionId,
        ticketCount,
        amountUsdc: config.amountPerPeriod,
        tokenAddress: config.tokenAddress,
        chainId: 8453, // Base
      });

      if (!purchaseResult.success) {
        // PERFORMANT: Track failures
        const newState = state || {
          userId,
          permissionId: config.permission.permissionId,
          lastExecutionTime: now,
          nextScheduledTime: this.calculateNextExecution(now, config.frequency),
          executionCount: 0,
          failureCount: 0,
        };
        newState.failureCount++;
        newState.lastError = purchaseResult.error?.message;
        this.executionStates.set(executionStateKey, newState);

        return {
          success: false,
          userId,
          error: {
            code: 'PURCHASE_FAILED',
            message: purchaseResult.error?.message || 'Purchase execution failed',
            isRetryable: true,
          },
        };
      }

      // PERFORMANT: Update execution state on success
      const nextExecution = this.calculateNextExecution(now, config.frequency);
      const newState: ExecutionState = {
        userId,
        permissionId: config.permission.permissionId,
        lastExecutionTime: now,
        nextScheduledTime: nextExecution,
        executionCount: (state?.executionCount || 0) + 1,
        failureCount: 0,
      };
      this.executionStates.set(executionStateKey, newState);

      return {
        success: true,
        userId,
        txHash: purchaseResult.txHash,
        nextScheduledTime: nextExecution,
      };
    } catch (error) {
      console.error('Permitted ticket execution failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        userId,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Execution failed: ${message}`,
          isRetryable: true,
        },
      };
    }
  }

  /**
   * CLEAN: Calculate next execution time based on frequency
   */
  private calculateNextExecution(
    currentTime: number,
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  ): number {
    const intervals = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      biweekly: 14 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    return currentTime + intervals[frequency];
  }

  /**
   * CLEAN: Batch execute multiple scheduled purchases
   * PERFORMANT: Process multiple users' auto-purchases in one operation
   */
  async executeBatch(configs: AutoPurchaseConfig[]): Promise<ExecutionResult[]> {
    return Promise.all(configs.map(config => this.executeScheduledPurchase(config)));
  }

  /**
   * MODULAR: Get execution history for user
   */
  getExecutionState(permissionId: string): ExecutionState | undefined {
    for (const state of this.executionStates.values()) {
      if (state.permissionId === permissionId) {
        return state;
      }
    }
    return undefined;
  }

  /**
   * CLEAN: Reset failure counter (for manual recovery)
   */
  resetFailureCounter(permissionId: string): boolean {
    for (const state of this.executionStates.values()) {
      if (state.permissionId === permissionId) {
        state.failureCount = 0;
        return true;
      }
    }
    return false;
  }

  /**
   * PERFORMANT: Get statistics for monitoring
   */
  getStats(): {
    activeConfigs: number;
    totalExecutions: number;
    totalFailures: number;
  } {
    let totalExecutions = 0;
    let totalFailures = 0;

    for (const state of this.executionStates.values()) {
      totalExecutions += state.executionCount;
      totalFailures += state.failureCount;
    }

    return {
      activeConfigs: this.executionStates.size,
      totalExecutions,
      totalFailures,
    };
  }
}

// =============================================================================
// SINGLETON & EXPORTS
// =============================================================================

export const permittedTicketExecutor = new PermittedTicketExecutor();

/**
 * CLEAN: API for Next.js route handler or backend job
 * 
 * Usage in Next.js API route:
 * ```
 * export default async function handler(req, res) {
 *   const result = await executePermittedTickets(configs);
 *   res.json(result);
 * }
 * ```
 */
export async function executePermittedTickets(configs: AutoPurchaseConfig[]): Promise<{
  successful: ExecutionResult[];
  failed: ExecutionResult[];
  nextCheck: number;
}> {
  const results = await permittedTicketExecutor.executeBatch(configs);
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  return {
    successful,
    failed,
    nextCheck: Date.now() + 60 * 1000, // Check again in 1 minute
  };
}
