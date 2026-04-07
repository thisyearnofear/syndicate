/**
 * RELAY SERVICE
 * 
 * Core Principles Applied:
 * - CLEAN: Centralized transaction relay logic
 * - MODULAR: Pluggable provider (Gelato Relay)
 * - PERFORMANT: Efficient transaction tracking and retry logic
 * - DRY: Single source of truth for submitting backend-signed transactions
 * 
 * Interfaces with Gelato Relay to execute transactions on behalf of users.
 */

import { Address, Hash, Hex, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// =============================================================================
// TYPES
// =============================================================================

export interface RelayRequest {
  chainId: number;
  target: Address;
  data: Hex;
  user?: Address;
}

export interface RelayResponse {
  taskId: string;
  success: boolean;
  error?: string;
}

export interface RelayStatus {
  taskId: string;
  taskState: 'CheckPending' | 'ExecPending' | 'ExecSuccess' | 'ExecReverted' | 'WaitingForConfirmation' | 'Blacklisted' | 'Cancelled' | 'NotFound';
  transactionHash?: Hash;
  lastCheck?: number;
  lastError?: string;
}

// =============================================================================
// RELAY SERVICE
// =============================================================================

class RelayService {
  private readonly gelatoRelayUrl = 'https://relay.gelato.digital';
  private readonly apiKey = process.env.GELATO_RELAY_API_KEY || '';
  
  /**
   * Submit a transaction to Gelato Relay
   */
  async relayTransaction(request: RelayRequest): Promise<RelayResponse> {
    if (!this.apiKey) {
      console.error('[RelayService] GELATO_RELAY_API_KEY not configured');
      return { taskId: '', success: false, error: 'Relay API key not configured' };
    }

    try {
      console.log(`[RelayService] Submitting relay request for ${request.target} on chain ${request.chainId}`);

      const response = await fetch(`${this.gelatoRelayUrl}/relays/v2/call-with-sync-fee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          chainId: request.chainId,
          target: request.target,
          data: request.data,
          feeToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
          isRelayContext: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          taskId: '',
          success: false,
          error: errorData.message || `HTTP error ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        taskId: data.taskId,
        success: true,
      };
    } catch (error) {
      console.error('[RelayService] Relay submission failed:', error);
      return {
        taskId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown relay error',
      };
    }
  }

  /**
   * Check status of a relay task
   */
  async getTaskStatus(taskId: string): Promise<RelayStatus> {
    try {
      const response = await fetch(`${this.gelatoRelayUrl}/tasks/status/${taskId}`);
      
      if (!response.ok) {
        return { taskId, taskState: 'NotFound', lastError: `HTTP error ${response.status}` };
      }

      const data = await response.json();
      const task = data.task;

      return {
        taskId,
        taskState: task.taskState,
        transactionHash: task.transactionHash,
        lastCheck: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      console.error('[RelayService] Status check failed:', error);
      return {
        taskId,
        taskState: 'NotFound',
        lastError: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Wait for a task to complete (polling)
   */
  async waitForTaskCompletion(taskId: string, maxAttempts = 20, intervalMs = 3000): Promise<RelayStatus> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getTaskStatus(taskId);
      
      if (status.taskState === 'ExecSuccess') {
        return status;
      }
      
      if (['ExecReverted', 'Cancelled', 'Blacklisted'].includes(status.taskState)) {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return { taskId, taskState: 'CheckPending', lastError: 'Timeout waiting for completion' };
  }
}

export const relayService = new RelayService();
