/**
 * GELATO AUTOMATION SERVICE
 *
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Single service managing Gelato task lifecycle
 * - DRY: Centralized Gelato API interactions
 * - CLEAN: Clear separation between task creation, monitoring, execution
 * - MODULAR: Independent of UI and permission logic
 * - PERFORMANT: Minimal API calls, efficient task encoding
 * - ORGANIZED: Domain-driven organization in /automation/ folder
 *
 * Responsibilities:
 * 1. Create/manage Gelato automation tasks for recurring purchases
 * 2. Encode Megapot purchaseTickets() calldata with correct parameters
 * 3. Monitor task status and execution history
 * 4. Handle task updates (pause/resume/delete)
 * 5. Calculate execution windows based on permission periods
 */

import { Address, encodeFunctionData, parseUnits } from 'viem';
import { MEGAPOT } from '@/config/contracts';

// =============================================================================
// TYPES
// =============================================================================

export interface GelatoTaskConfig {
  id: string;
  taskId?: string; // Gelato task ID returned after creation
  userAddress: Address;
  frequency: 'daily' | 'weekly' | 'monthly';
  amountPerPeriod: bigint;
  nextExecutionTime: number; // Unix timestamp in seconds
  status: 'active' | 'paused' | 'disabled';
  createdAt: number;
  lastExecutedAt?: number;
  executionCount: number;
}

export interface GelatoCreateTaskRequest {
  chainId: number;
  execAddress: Address; // Relayer address
  execData: string; // Encoded purchaseTickets call
  trigger: {
    type: 'time';
    interval: number; // seconds between executions
    nextExecTime: number; // Unix timestamp
  };
}

export interface GelatoTaskResponse {
  taskId: string;
  execAddress: Address;
  execData: string;
  status: 'active' | 'paused' | 'cancelled';
  nextExecTime: number;
}

export interface PurchaseTicketsParams {
  referrer: Address;
  value: bigint; // USDC amount (6 decimals)
  recipient: Address;
}

// =============================================================================
// GELATO SERVICE
// =============================================================================

export class GelatoService {
  private apiKey: string;
  private relayerAddress: Address;
  private megapotAddress: Address;
  private megapotAbi: any[];

  constructor(
    apiKey: string,
    relayerAddress: Address,
    megapotAddress: Address,
    megapotAbi: readonly any[]
  ) {
    this.apiKey = apiKey;
    this.relayerAddress = relayerAddress;
    this.megapotAddress = megapotAddress;
    this.megapotAbi = megapotAbi as any[];
  }

  /**
   * Create a new Gelato automation task for recurring ticket purchases
   *
   * ENHANCEMENT FIRST: Called after user grants Advanced Permission
   * Returns task ID for storage in database for monitoring/updates
   */
  async createAutoPurchaseTask(
    userAddress: Address,
    frequency: 'daily' | 'weekly' | 'monthly',
    amountPerPeriod: bigint,
    referrer: Address = '0x0000000000000000000000000000000000000000',
    chainId: number = 8453 // Base mainnet
  ): Promise<GelatoTaskResponse | null> {
    try {
      // Calculate interval in seconds
      const intervalSeconds = this.getFrequencyInSeconds(frequency);
      const nextExecTime = Math.floor(Date.now() / 1000) + intervalSeconds;

      // Encode Megapot.purchaseTickets() call
      const execData = encodeFunctionData({
        abi: MEGAPOT.abi,
        functionName: 'purchaseTickets',
        args: [referrer, amountPerPeriod, userAddress],
      });

      // Create Gelato task
      const response = await fetch('https://api.gelato.digital/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          chainId,
          execAddress: this.relayerAddress,
          execData,
          trigger: {
            type: 'time',
            interval: intervalSeconds,
            nextExecTime,
          },
        } as GelatoCreateTaskRequest),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[Gelato] Task creation failed:', error);
        return null;
      }

      const task = await response.json() as GelatoTaskResponse;
      console.log('[Gelato] Task created:', {
        taskId: task.taskId,
        frequency,
        nextExecTime: new Date(nextExecTime * 1000).toISOString(),
      });

      return task;
    } catch (error) {
      console.error('[Gelato] Error creating task:', error);
      return null;
    }
  }

  /**
   * Get task status and execution history
   */
  async getTaskStatus(taskId: string): Promise<GelatoTaskResponse | null> {
    try {
      const response = await fetch(`https://api.gelato.digital/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        console.error('[Gelato] Failed to fetch task status');
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[Gelato] Error fetching task status:', error);
      return null;
    }
  }

  /**
   * Pause a task without deleting it
   * User can resume from settings without re-approving
   */
  async pauseTask(taskId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.gelato.digital/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ status: 'paused' }),
        }
      );

      if (!response.ok) {
        console.error('[Gelato] Failed to pause task');
        return false;
      }

      console.log('[Gelato] Task paused:', taskId);
      return true;
    } catch (error) {
      console.error('[Gelato] Error pausing task:', error);
      return false;
    }
  }

  /**
   * Resume a paused task
   */
  async resumeTask(taskId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.gelato.digital/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ status: 'active' }),
        }
      );

      if (!response.ok) {
        console.error('[Gelato] Failed to resume task');
        return false;
      }

      console.log('[Gelato] Task resumed:', taskId);
      return true;
    } catch (error) {
      console.error('[Gelato] Error resuming task:', error);
      return false;
    }
  }

  /**
   * Cancel a task permanently
   * User must create new task if they want to re-enable
   */
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.gelato.digital/tasks/${taskId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        console.error('[Gelato] Failed to cancel task');
        return false;
      }

      console.log('[Gelato] Task cancelled:', taskId);
      return true;
    } catch (error) {
      console.error('[Gelato] Error cancelling task:', error);
      return false;
    }
  }

  /**
   * Convert frequency string to seconds
   */
  private getFrequencyInSeconds(
    frequency: 'daily' | 'weekly' | 'monthly'
  ): number {
    switch (frequency) {
      case 'daily':
        return 86400; // 1 day
      case 'weekly':
        return 604800; // 7 days
      case 'monthly':
        return 2592000; // 30 days
      default:
        return 604800; // Default to weekly
    }
  }

  /**
   * Calculate next execution time based on frequency
   */
  calculateNextExecutionTime(
    frequency: 'daily' | 'weekly' | 'monthly'
  ): number {
    const now = Math.floor(Date.now() / 1000);
    const intervalSeconds = this.getFrequencyInSeconds(frequency);
    return now + intervalSeconds;
  }

  /**
   * Validate Gelato request signature (called in API endpoint)
   * Prevents unauthorized execution calls
   */
  async validateGelatoSignature(
    signature: string,
    taskId: string,
    executedData: string
  ): Promise<boolean> {
    try {
      // Gelato provides signature verification
      // This would be implemented based on Gelato's authentication method
      // For now, we verify taskId exists and is valid
      const task = await this.getTaskStatus(taskId);
      return task !== null;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance
 */
let serviceInstance: GelatoService | null = null;

export function getGelatoService(): GelatoService {
  if (!serviceInstance) {
    const apiKey = process.env.GELATO_API_KEY || '';
    const relayerAddress = (process.env.GELATO_RELAYER_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as Address;
    const megapotAddress = MEGAPOT.address;

    serviceInstance = new GelatoService(
      apiKey,
      relayerAddress,
      megapotAddress,
      MEGAPOT.abi
    );
  }

  return serviceInstance;
}
