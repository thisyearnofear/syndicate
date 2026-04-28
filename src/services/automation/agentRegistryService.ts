/**
 * AGENT REGISTRY SERVICE
 * 
 * Core Principles Applied:
 * - AGGRESSIVE CONSOLIDATION: Unified interface for all automation types
 * - DRY: Single source of truth for agent status across ERC-7715, WDK, and x402
 * - CLEAN: Explicit separation of concerns for different execution strategies
 * - MODULAR: Pluggable agent types for future expansion
 * 
 * This service unifies:
 * 1. Scheduled Agents (ERC-7715/MetaMask) - USDC
 * 2. Autonomous AI Agents (Tether WDK) - USD₮
 * 3. SIP-018 Agents (Stacks x402) - USDCx/sBTC
 */

import { Address } from 'viem';

export type AgentType = 'scheduled' | 'autonomous' | 'stacks-x402' | 'ton-agentic';

export interface AgentStatus {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  isEnabled: boolean;
  status: 'active' | 'paused' | 'expired' | 'low-balance' | 'inactive';
  tokenSymbol: 'USDC' | 'USD₮' | 'USDCx' | 'sBTC' | 'USDT';
  tokenAddress: string;
  chainName: 'Base' | 'Solana' | 'Stacks' | 'NEAR' | 'TON';
  balance?: bigint;
  allowance?: bigint;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'opportunistic';
  lastExecution?: number;
  nextExecution?: number;
  lastReasoning?: string; // Specifically for AI agents
  address?: Address; // For WDK agents with their own address
}

export class AgentRegistryService {
  private static instance: AgentRegistryService;

  private constructor() {}

  public static getInstance(): AgentRegistryService {
    if (!AgentRegistryService.instance) {
      AgentRegistryService.instance = new AgentRegistryService();
    }
    return AgentRegistryService.instance;
  }

  /**
   * Get all agents for the current user
   */
  async getUserAgents(_userAddress: string): Promise<AgentStatus[]> {
    const agents: AgentStatus[] = [];

    // 1. Check Scheduled Agent (ERC-7715)
    const scheduledAgent = await this.getScheduledAgent(_userAddress);
    if (scheduledAgent) agents.push(scheduledAgent);

    // 2. Check Autonomous Agent (WDK)
    const autonomousAgent = await this.getAutonomousAgent(_userAddress);
    if (autonomousAgent) agents.push(autonomousAgent);

    // 3. Check Stacks Agent (x402)
    const stacksAgent = await this.getStacksAgent(_userAddress);
    if (stacksAgent) agents.push(stacksAgent);

    // 4. Check No-Loss Agent (PoolTogether)
    const noLossAgent = await this.getNoLossAgent(_userAddress);
    if (noLossAgent) agents.push(noLossAgent);

    // 5. Check NEAR Agent (Chain Signatures)
    const nearAgent = await this.getNearAgent(_userAddress);
    if (nearAgent) agents.push(nearAgent);

    // 6. Check TON Agent (Agentic Wallet)
    const tonAgent = await this.getTonAgent(_userAddress);
    if (tonAgent) agents.push(tonAgent);

    return agents;
  }

  private async getNearAgent(_userAddress: string): Promise<AgentStatus | null> {
    try {
      if (typeof window === 'undefined') return null;
      
      const isEnabled = localStorage.getItem('syndicate_near_enabled') === 'true';
      const configStr = localStorage.getItem('syndicate_near_config');
      const config = configStr ? JSON.parse(configStr) : null;
      
      return {
        id: `near-${_userAddress.slice(0, 6)}`,
        type: 'scheduled' as any,
        name: 'The Nomad (NEAR)',
        description: 'Cross-chain automation using NEAR Chain Signatures. Gas-optimized ticket purchases.',
        isEnabled: isEnabled,
        status: isEnabled ? 'active' : 'inactive',
        tokenSymbol: 'USDC',
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        chainName: 'NEAR',
        frequency: config?.frequency || 'weekly',
        lastExecution: isEnabled && config ? config.activatedAt : undefined,
      };
    } catch {
      return null;
    }
  }

  private async getNoLossAgent(_userAddress: string): Promise<AgentStatus | null> {
    try {
      if (typeof window === 'undefined') return null;
      
      const isEnabled = localStorage.getItem('syndicate_noloss_enabled') === 'true';
      const configStr = localStorage.getItem('syndicate_noloss_config');
      const config = configStr ? JSON.parse(configStr) : null;
      
      return {
        id: `noloss-${_userAddress.slice(0, 6)}`,
        type: 'scheduled' as any, // Visual tier
        name: 'Savings Sentinel',
        description: 'No-loss prize savings via PoolTogether v5. 100% principal protection.',
        isEnabled: isEnabled,
        status: isEnabled ? 'active' : 'inactive',
        tokenSymbol: 'USDC',
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        balance: isEnabled && config ? BigInt(config.amount * 10 ** 6) : BigInt(0),
        frequency: 'weekly',
        lastExecution: isEnabled && config ? config.activatedAt : undefined,
        chainName: 'Base',
      };
    } catch {
      return null;
    }
  }

  private async getScheduledAgent(_userAddress: string): Promise<AgentStatus | null> {
    // In a real app, this would query local storage + database
    try {
      const configStr = typeof window !== 'undefined' ? localStorage.getItem('syndicate_autopurchase_config') : null;
      if (!configStr) return null;

      const config = JSON.parse(configStr);
      return {
        id: config.permissionId || 'scheduled-1',
        type: 'scheduled',
        name: 'Scheduled Optimizer',
        description: 'Reliable weekly/monthly ticket purchases via MetaMask permissions.',
        isEnabled: true,
        status: 'active',
        tokenSymbol: 'USDC',
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        chainName: 'Base',
        frequency: config.frequency || 'weekly',
        nextExecution: config.nextExecutionTime,
      };
    } catch {
      return null;
    }
  }

  private async getAutonomousAgent(_userAddress: string): Promise<AgentStatus | null> {
    try {
      if (typeof window === 'undefined') return null;
      
      const isEnabled = localStorage.getItem('syndicate_wdk_enabled') === 'true';
      const configStr = localStorage.getItem('syndicate_wdk_config');
      const config = configStr ? JSON.parse(configStr) : null;
      
      return {
        id: `wdk-${_userAddress.slice(0, 6)}`,
        type: 'autonomous',
        name: 'The Voyager (AI)',
        description: 'Autonomous AI agent using Tether WDK. Decides when to buy based on yield performance.',
        isEnabled: isEnabled,
        status: isEnabled ? 'active' : 'inactive',
        tokenSymbol: 'USD₮',
        tokenAddress: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        balance: isEnabled && config ? BigInt(config.amount * 10 ** 6) : BigInt(0),
        frequency: 'opportunistic',
        lastExecution: isEnabled && config ? config.activatedAt : undefined,
        lastReasoning: isEnabled ? 'Syndicate yield is currently high (22.5% APY). Monitoring for next purchase window.' : undefined,
        address: '0x' + 'e'.repeat(40) as Address, // Mock WDK address for agent
        chainName: 'Base',
      };
    } catch {
      return null;
    }
  }

  private async getStacksAgent(_userAddress: string): Promise<AgentStatus | null> {
    try {
      const configStr = typeof window !== 'undefined' ? localStorage.getItem('syndicate_stacks_autopurchase') : null;
      if (!configStr) return null;

      const config = JSON.parse(configStr);
      return {
        id: config.authorizationId || 'stacks-1',
        type: 'stacks-x402',
        name: 'Stacks Sentinel',
        description: 'Recurring purchases on Stacks using SIP-018 signatures.',
        isEnabled: true,
        status: 'active',
        tokenSymbol: config.paymentToken === 'sbtc' ? 'sBTC' : 'USDCx',
        tokenAddress: config.tokenAddress || '',
        chainName: 'Stacks',
        frequency: config.frequency || 'weekly',
        nextExecution: config.nextExecutionTime,
      };
    } catch {
      return null;
    }
  }

  private async getTonAgent(_userAddress: string): Promise<AgentStatus | null> {
    try {
      const configStr = typeof window !== 'undefined' ? localStorage.getItem('syndicate_ton_agent_config') : null;
      if (!configStr) return null;

      const config = JSON.parse(configStr);
      return {
        id: `ton-${_userAddress.slice(0, 6)}`,
        type: 'ton-agentic',
        name: 'The Conductor (TON)',
        description: 'Autonomous agent on TON via Telegram. Purchases tickets with USDT/TON yield.',
        isEnabled: config.isEnabled ?? false,
        status: config.isEnabled ? 'active' : 'inactive',
        tokenSymbol: config.token === 'USDT' ? 'USDT' : 'USDC',
        tokenAddress: '',
        chainName: 'TON',
        frequency: config.frequency || 'weekly',
        lastExecution: config.isEnabled ? config.activatedAt : undefined,
        nextExecution: config.isEnabled ? Date.now() + 7 * 24 * 60 * 60 * 1000 : undefined,
        lastReasoning: config.isEnabled ? 'Monitoring TON wallet for yield accrual. Ready to auto-purchase tickets.' : undefined,
      };
    } catch {
      return null;
    }
  }
}
