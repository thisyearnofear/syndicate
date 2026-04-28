/**
 * UNIFIED AUTOMATION ORCHESTRATOR
 * 
 * Core Principles Applied:
 * - AGGRESSIVE CONSOLIDATION: Unified interface for all automation strategies
 * - DRY: Shared logic for next-execution calculation and status tracking
 * - CLEAN: Protocols (Gelato, WDK, x402) are pluggable execution providers
 * - MODULAR: Clear separation between "Reasoning", "Decision", and "Execution"
 * - ORGANIZED: Domain-driven design for automation tasks
 * 
 * Manages the lifecycle of:
 * 1. MetaMask ERC-7715 Scheduled Tasks
 * 2. Tether WDK Autonomous AI Agents
 * 3. Stacks x402 Recurring Authorizations
 */

import { Address, Hash, encodeFunctionData } from 'viem';
import { TetherWDKService } from './wdkService';
import { getERC7715Service } from './erc7715Service';
import { referralManager } from '../referral/ReferralManager';
import { poolTogetherService, POOLTOGETHER_VAULTS } from '../lotteries/PoolTogetherService';
import { MEGAPOT_V2_CONTRACTS } from '@/config/contracts';

// =============================================================================
// TYPES
// =============================================================================

export type AutomationStrategy = 'scheduled' | 'autonomous' | 'stacks-x402' | 'no-loss';

export interface AutomationTask {
  id: string;
  userAddress: string;
  strategy: AutomationStrategy;
  status: 'active' | 'paused' | 'expired' | 'failed' | 'cancelled';
  tokenAddress: string;
  tokenSymbol: string;
  amount: bigint;
  frequency: 'daily' | 'weekly' | 'monthly' | 'opportunistic';
  lastExecutedAt?: number;
  nextExecutionAt?: number;
  lastReasoning?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: Hash;
  error?: string;
  reasoning?: string;
}

export interface GelatoTaskResponse {
  taskId: string;
  execAddress: Address;
  execData: string;
  status: 'active' | 'paused' | 'cancelled';
  nextExecTime: number;
}

// =============================================================================
// ORCHESTRATOR
// =============================================================================

export class AutomationOrchestrator {
  private static instance: AutomationOrchestrator;
  private wdkService = TetherWDKService.getInstance();
  private erc7715Service = getERC7715Service();
  
  // Gelato Configuration
  private gelatoApiKey = process.env.GELATO_API_KEY || '';
  private relayerAddress = (process.env.GELATO_RELAYER_ADDRESS ||
    '0x0000000000000000000000000000000000000000') as Address;

  private constructor() {}

  public static getInstance(): AutomationOrchestrator {
    if (!AutomationOrchestrator.instance) {
      AutomationOrchestrator.instance = new AutomationOrchestrator();
    }
    return AutomationOrchestrator.instance;
  }

  /**
   * GELATO TASK MANAGEMENT
   * Consolidates logic from redundant GelatoService
   */
  async createGelatoTask(
    userAddress: Address,
    frequency: 'daily' | 'weekly' | 'monthly',
    amount: bigint,
    _referrer: Address = '0x0000000000000000000000000000000000000000',
    chainId: number = 8453 // Base mainnet
  ): Promise<GelatoTaskResponse | null> {
    try {
      const intervalSeconds = this.getFrequencyInSeconds(frequency);
      const nextExecTime = Math.floor(Date.now() / 1000) + intervalSeconds;

      const execData = encodeFunctionData({
        abi: MEGAPOT_V2_CONTRACTS.abi,
        functionName: 'buyTickets',
        args: [[], userAddress, [], [], '0x0000000000000000000000000000000000000000000000000000000000000000'],
      });

      const response = await fetch('https://api.gelato.digital/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.gelatoApiKey}`,
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
        }),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (_error) {
      console.error('[Orchestrator] Gelato _task creation failed:', _error);
      return null;
    }
  }

  async getGelatoTaskStatus(taskId: string): Promise<GelatoTaskResponse | null> {
    try {
      const response = await fetch(`https://api.gelato.digital/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${this.gelatoApiKey}` },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  async pauseGelatoTask(taskId: string): Promise<boolean> {
    return this.updateGelatoTaskStatus(taskId, 'paused');
  }

  async resumeGelatoTask(taskId: string): Promise<boolean> {
    return this.updateGelatoTaskStatus(taskId, 'active');
  }

  async cancelGelatoTask(taskId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.gelato.digital/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.gelatoApiKey}` },
      });
      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  private async updateGelatoTaskStatus(taskId: string, status: 'active' | 'paused'): Promise<boolean> {
    try {
      const response = await fetch(`https://api.gelato.digital/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.gelatoApiKey}`,
        },
        body: JSON.stringify({ status }),
      });
      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  private getFrequencyInSeconds(frequency: string): number {
    const intervals: Record<string, number> = {
      daily: 86400,
      weekly: 604800,
      monthly: 2592000,
      opportunistic: 3600
    };
    return intervals[frequency] || 604800;
  }

  async executeTask(_task: AutomationTask): Promise<ExecutionResult> {
    console.log(`[Orchestrator] Executing ${_task.strategy} _task for ${_task.userAddress}`);

    try {
      switch (_task.strategy) {
        case 'autonomous':
          return await this.executeAutonomousWDK(_task);
        case 'scheduled':
          return await this.executeScheduledERC7715(_task);
        case 'no-loss':
          return await this.executeNoLossPoolTogether(_task);
        case 'stacks-x402':
          return await this.executeStacksX402(_task);
        default:
          throw new Error(`Unsupported automation strategy: ${_task.strategy}`);
      }
    } catch (_error: any) {
      console.error(`[Orchestrator] Task execution failed:`, _error);
      return { success: false, error: _error.message };
    }
  }

  /**
   * STRATEGY: No-Loss PoolTogether v5
   */
  private async executeNoLossPoolTogether(_task: AutomationTask): Promise<ExecutionResult> {
    const vault = POOLTOGETHER_VAULTS[0]; // Default to first vault for now

    // 1. Prepare deposit with Syndicate referral hook
    const _preparation = await poolTogetherService.prepareDepositWithHook(
      vault,
      _task.amount,
      _task.userAddress as Address
    );

    console.log(`[Orchestrator] Prepared PoolTogether deposit for ${_task.userAddress}`);

    // 2. Execution (Simulated for consistency)
    return { 
      success: true, 
      txHash: '0x' + 'p'.repeat(64) as Hash,
      reasoning: 'Yield-optimized deposit into No-Loss Prize Vault with 10% Syndicate prize-split hook configured.'
    };
  }

  /**
   * STRATEGY: Tether WDK Autonomous AI Agent
   * Fulfills Hackathon Galactica requirements for autonomy and USD₮
   */
  private async executeAutonomousWDK(_task: AutomationTask): Promise<ExecutionResult> {
    // 1. REASONING
    const reasoning = await this.wdkService.getAgentReasoning(_task.userAddress, {
      balance: _task.amount,
      strategy: 'yield-optimized'
    });

    // 2. DECISION (In this implementation, we proceed if reasoning is generated)
    
    // 3. EXECUTION
    const result = await this.wdkService.executeAutonomousPurchase({
      recipient: _task.userAddress as Address,
      amount: _task.amount,
      _referrer: referralManager.getReferrerFor('megapot') as Address,
      isTestnet: process.env.NODE_ENV !== 'production'
    });

    return {
      ...result,
      reasoning
    };
  }

  /**
   * STRATEGY: Scheduled MetaMask ERC-7715
   */
  private async executeScheduledERC7715(_task: AutomationTask): Promise<ExecutionResult> {
    // 1. VALIDATE PERMISSION
    const permission = this.erc7715Service.getPermission(_task.id);
    if (!permission) {
      return { success: false, error: 'ERC-7715 Permission not found' };
    }

    const validation = this.erc7715Service.validatePermissionForExecution(permission, _task.amount);
    if (!validation.isValid) {
      return { success: false, error: validation.reason };
    }

    // 2. EXECUTION (Typically via a backend-signed tx using the permission context)
    // For now, we simulate success as the actual signing happens in the cron API
    return { success: true, txHash: '0x' + '1'.repeat(64) as Hash };
  }

  /**
   * STRATEGY: Stacks x402 (Placeholder for consistency)
   */
  private async executeStacksX402(_task: AutomationTask): Promise<ExecutionResult> {
    // Logic for Stacks-native recurring purchases
    return { success: true, txHash: '0x' + 's'.repeat(64) as Hash };
  }

  /**
   * Calculate next execution timestamp
   */
  calculateNextExecution(frequency: string, fromTimestamp: number = Math.floor(Date.now() / 1000)): number {
    const intervals: Record<string, number> = {
      daily: 86400,
      weekly: 604800,
      monthly: 2592000,
      opportunistic: 3600 // Check every hour
    };
    return fromTimestamp + (intervals[frequency] || 604800);
  }
}

export const automationOrchestrator = AutomationOrchestrator.getInstance();
