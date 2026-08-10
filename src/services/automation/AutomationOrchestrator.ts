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

import { Address, Hash, encodeFunctionData, parseAbi, parseEther, zeroHash } from 'viem';
import { TetherWDKService } from './wdkService';
import { VirtualsService } from './VirtualsService';
import { getERC7715Service } from './erc7715Service';
import { referralManager } from '../referral/ReferralManager';
import { poolTogetherService, POOLTOGETHER_VAULTS } from '../lotteries/PoolTogetherService';
import { MEGAPOT_V2_CONTRACTS, RANDOM_TICKET_BUYER_ABI } from '@/config/contracts';

// Mirror of the real client-side purchase path
// (TransactionExecutor.purchaseTickets / yieldAutopilotAgent.buildExecutionPlan):
// Megapot V2 tickets are bought through the JackpotRandomTicketBuyer contract,
// which pulls USDC and assigns random numbers on-chain. $1 USDC = 1 ticket.
// ABI + address are single-sourced in @/config/contracts.
const RANDOM_TICKET_BUYER_PARSED_ABI = parseAbi(RANDOM_TICKET_BUYER_ABI);
const RANDOM_TICKET_BUYER_ADDRESS = MEGAPOT_V2_CONTRACTS.randomTicketBuyer.address as Address;
/** 1 USDC (6 decimals) buys 1 ticket on Megapot V2. */
const USDC_PER_TICKET = 1_000_000n;

function ticketsFromUsdcAmount(amount: bigint): bigint {
  return amount / USDC_PER_TICKET;
}

/**
 * Encode a real Megapot random-ticket purchase for server-side executors
 * (Gelato, Virtuals agent wallet). Requires the signing wallet to hold the
 * USDC and to have approved the RandomTicketBuyer for the purchase amount.
 */
function encodeRandomTicketPurchase(
  ticketCount: bigint,
  recipient: Address,
): `0x${string}` {
  return encodeFunctionData({
    abi: RANDOM_TICKET_BUYER_PARSED_ABI,
    functionName: 'buyTickets',
    args: [
      ticketCount,
      recipient,
      [referralManager.getReferrerFor('megapot') as Address],
      [parseEther('1')],
      zeroHash,
    ],
  });
}

// =============================================================================
// TYPES
// =============================================================================

export type AutomationStrategy = 'scheduled' | 'autonomous' | 'stacks-x402' | 'no-loss' | 'virtuals-acp';

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
  /** Email recipient for the post-execution report (Virtuals strategy). */
  recipientEmail?: string;
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
  private virtualsService = VirtualsService.getInstance();

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
      // Scheduling a task against an unconfigured relayer would burn Gelato
      // quota on a guaranteed failure — refuse instead.
      if (this.relayerAddress === '0x0000000000000000000000000000000000000000') {
        console.warn('[Orchestrator] GELATO_RELAYER_ADDRESS is not configured; refusing to create a Gelato task.');
        return null;
      }

      const ticketCount = ticketsFromUsdcAmount(amount);
      if (ticketCount < 1n) {
        console.warn('[Orchestrator] Amount is below one Megapot ticket price; refusing to create a Gelato task.', { amount: amount.toString() });
        return null;
      }

      const intervalSeconds = this.getFrequencyInSeconds(frequency);
      const nextExecTime = Math.floor(Date.now() / 1000) + intervalSeconds;

      const execData = encodeRandomTicketPurchase(ticketCount, userAddress);

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
        case 'virtuals-acp':
          return await this.executeVirtualsAgentTask(_task);
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
    } catch (_error: unknown) {
      console.error(`[Orchestrator] Task execution failed:`, _error);
      return { success: false, error: _error instanceof Error ? _error.message : String(_error) };
    }
  }

  /**
   * STRATEGY: Virtuals Protocol (EconomyOS) Autonomous Agent
   */
  private async executeVirtualsAgentTask(_task: AutomationTask): Promise<ExecutionResult> {
    // 1. REASONING (Powered by Venice AI credits)
    const reasoning = await this.virtualsService.getVeniceReasoning(
      `As a Syndicate Vault Strategist for user ${_task.userAddress}, evaluate the current strategy for ${_task.amount} ${(_task.tokenSymbol)}.`
    );

    // 2. EXECUTION (Via Virtuals Agent Wallet)
    //
    // Real Megapot purchase payload, mirrored from the client-side path:
    // RandomTicketBuyer.buyTickets(count, recipient, referrers, splitBps, source).
    // Note: the agent wallet must hold the USDC and have approved the
    // RandomTicketBuyer for the purchase amount, otherwise the transaction
    // will revert on-chain (and we report that failure, never a success).
    const ticketCount = ticketsFromUsdcAmount(_task.amount);
    if (ticketCount < 1n) {
      return {
        success: false,
        reasoning,
        error: `Amount ${_task.amount} ${_task.tokenSymbol} is below one Megapot ticket price ($1 USDC); no purchase executed.`,
      };
    }

    const result = await this.virtualsService.executeAgentTransaction({
      to: RANDOM_TICKET_BUYER_ADDRESS,
      value: 0n,
      data: encodeRandomTicketPurchase(ticketCount, _task.userAddress as Address),
      chainId: 8453
    });

    // 3. REPORTING (Via Agent Email)
    // The previous code hardcoded 'member@syndicate.xyz' which meant every
    // task's report went to the same mailbox regardless of who triggered
    // it. Now we honor the task's `recipientEmail` (set by the persisted
    // task record), with a safe fallback to the agent's own email so a
    // missing field never silently drops the report.
    const agentInfo = await this.virtualsService.getActiveAgent();
    const recipient = _task.recipientEmail || agentInfo?.email || '';
    if (recipient) {
      await this.virtualsService.sendEmailReport({
        to: recipient,
        subject: `Syndicate Strategy Update: ${_task.strategy}`,
        body: `Execution Result: ${result.success ? 'Success' : 'Failed'}\nReasoning: ${reasoning}\nTx: ${result.txHash}`
      });
    } else {
      console.warn('[Orchestrator] Virtuals task has no recipient email; skipping report.');
    }

    return {
      ...result,
      reasoning
    };
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

    // Execution cannot happen here: depositing into the PrizeVault moves the
    // user's funds, which requires the user's wallet signature (or a granted
    // permission). Never fabricate a success — report the strategy as not
    // executable so the job processor backs off instead of recording a
    // phantom deposit.
    return {
      success: false,
      error:
        'No-loss PoolTogether automation is not executable server-side: the deposit requires the user\'s wallet signature. ' +
        'Use the ERC-7715/1Shot permissioned autopilot path for delegated execution.',
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

    // 2. EXECUTION: redeeming an ERC-7715 permission into a real transaction
    // requires the MetaMask smart-accounts-kit integration, which
    // erc7715Service does not have yet (it stores draft sessions in
    // localStorage). Report an honest failure instead of a simulated hash —
    // the job processor will back off and auto-pause after repeated failures.
    return {
      success: false,
      error:
        'ERC-7715 execution is not available yet: smart session redemption requires the MetaMask smart-accounts-kit integration. ' +
        'The granted permission is valid but cannot be redeemed automatically at this time.',
    };
  }

  /**
   * STRATEGY: Stacks x402
   *
   * Authorization, challenge, limit, and revoke flows are implemented in
   * stacksX402Service; automated purchase execution is not. Never fabricate
   * a transaction hash.
   */
  private async executeStacksX402(_task: AutomationTask): Promise<ExecutionResult> {
    return {
      success: false,
      error:
        'Stacks x402 auto-purchase is not implemented yet. Authorization management (create/revoke/limits) is supported; the purchase leg still requires the user to complete a one-off bridge purchase.',
    };
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
