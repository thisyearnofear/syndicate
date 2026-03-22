/**
 * TON AGENT SERVICE
 *
 * Agentic Wallet + TON MCP integration for autonomous ticket purchases.
 * Agent holds its own TON wallet, monitors yield, auto-purchases via Payment Channels.
 *
 * DRY: Agent status is aggregated by agentRegistryService.ts (single source of truth).
 * This file provides config persistence and MCP tool definitions only.
 */

export interface TonAgentConfig {
  agentAddress: string;
  userAddress: string;
  telegramUserId?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  ticketsPerFrequency: number;
  token: 'TON' | 'USDT';
  isEnabled: boolean;
}

const STORAGE_KEY = 'syndicate_ton_agent_config';

export function getTonAgentConfig(): TonAgentConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TonAgentConfig) : null;
  } catch {
    return null;
  }
}

export function saveTonAgentConfig(config: TonAgentConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearTonAgentConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export const TON_MCP_TOOLS = {
  buy_ticket: {
    name: 'buy_ticket',
    description: 'Purchase a Megapot lottery ticket using USDT/TON on TON',
    parameters: {
      amount: { type: 'number', description: 'Number of tickets to buy' },
      token: { type: 'string', enum: ['TON', 'USDT'] },
    },
  },
  check_balance: {
    name: 'check_balance',
    description: 'Check USDT/TON balance on user TON wallet',
    parameters: {
      userAddress: { type: 'string', description: 'User TON wallet address' },
      token: { type: 'string', enum: ['TON', 'USDT'] },
    },
  },
  get_yield: {
    name: 'get_yield',
    description: 'Get accrued yield on user TON wallet',
    parameters: {
      userAddress: { type: 'string', description: 'User TON wallet address' },
    },
  },
  configure_schedule: {
    name: 'configure_schedule',
    description: 'Configure automatic purchase schedule',
    parameters: {
      frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
      ticketsPerFrequency: { type: 'number' },
      token: { type: 'string', enum: ['TON', 'USDT'] },
    },
  },
} as const;
