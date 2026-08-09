/**
 * Pure planners for Base yield/autopilot agent plans.
 */

import { ensureBaseToolsRegistered } from '../tools/baseTools';
import type { AgentPlan, AgentToolCall } from '../tools/types';
import type { VenicePolicyRecommendation } from '../venicePolicyAdvisor';

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface BaseYieldPlanInput {
  yieldUsdc: number;
  maxSpendUsdc: number;
  ticketCount: number;
  sourceVault: string;
  policyId?: string | null;
  period?: 'weekly' | 'monthly' | 'opportunistic';
  /** Optional Venice / heuristic policy advice to attach. */
  advice?: Pick<
    VenicePolicyRecommendation,
    'sourceVault' | 'period' | 'maxSpendUsdc' | 'ticketCount' | 'rationale' | 'warnings'
  > | null;
}

export function planYieldSpendFromContext(input: BaseYieldPlanInput): {
  status: 'ready' | 'waiting' | 'blocked';
  ticketsPlanned: number;
  spendableUsdc: number;
  message: string;
} {
  const available = Math.max(0, input.yieldUsdc);
  const maxSpend = Math.max(0, input.maxSpendUsdc);
  const spendable = Math.min(available, maxSpend);
  const ticketsPlanned = Math.min(input.ticketCount, Math.floor(spendable));

  if (!Number.isFinite(available) || !Number.isFinite(maxSpend)) {
    return {
      status: 'blocked',
      ticketsPlanned: 0,
      spendableUsdc: 0,
      message: 'Yield snapshot is invalid.',
    };
  }

  if (ticketsPlanned <= 0) {
    return {
      status: 'waiting',
      ticketsPlanned: 0,
      spendableUsdc: spendable,
      message: `Waiting for at least 1 USDC of available ${input.sourceVault} yield under the spend cap.`,
    };
  }

  return {
    status: 'ready',
    ticketsPlanned,
    spendableUsdc: spendable,
    message: `Ready to prepare ${ticketsPlanned} ticket${ticketsPlanned === 1 ? '' : 's'} from accrued yield.`,
  };
}

export function buildPlanFromBaseYieldContext(input: BaseYieldPlanInput): AgentPlan {
  ensureBaseToolsRegistered();
  const now = Date.now();
  const spend = planYieldSpendFromContext(input);

  const steps: AgentToolCall[] = [
    {
      id: newId('step'),
      toolId: 'base.getYieldSnapshot',
      args: {
        yieldUsdc: input.yieldUsdc,
        maxSpendUsdc: input.maxSpendUsdc,
        sourceVault: input.sourceVault,
        policyId: input.policyId ?? null,
      },
      status: 'proposed',
      proposedAt: now,
    },
    {
      id: newId('step'),
      toolId: 'base.planYieldSpend',
      args: {
        ...spend,
        ticketCountCap: input.ticketCount,
      },
      status: 'proposed',
      proposedAt: now,
    },
  ];

  if (input.advice) {
    steps.push({
      id: newId('step'),
      toolId: 'base.proposeAutopilotPolicy',
      args: {
        sourceVault: input.advice.sourceVault,
        period: input.advice.period,
        maxSpendUsdc: input.advice.maxSpendUsdc,
        ticketCount: input.advice.ticketCount,
        rationale: input.advice.rationale,
        warnings: input.advice.warnings,
      },
      status: 'proposed',
      proposedAt: now,
    });
  }

  const rationale = [
    spend.message,
    ...(input.advice?.rationale ?? []).slice(0, 2),
  ];

  const warnings = [
    'Applying a policy still requires an explicit MetaMask permission approval.',
    ...(input.advice?.warnings ?? []).slice(0, 2),
  ];

  return {
    id: newId('plan'),
    chain: 'base',
    rationale,
    warnings,
    source: input.advice ? 'venice' : 'heuristic',
    steps,
    createdAt: now,
  };
}

/** Deterministic heuristic policy when Venice is unavailable. */
export function buildHeuristicAutopilotAdvice(input: {
  currentAmount: number;
  currentFrequency: 'weekly' | 'monthly' | 'opportunistic';
  currentSourceVault: string;
}): Pick<
  VenicePolicyRecommendation,
  'sourceVault' | 'period' | 'maxSpendUsdc' | 'ticketCount' | 'rationale' | 'warnings'
> {
  const amount = Math.max(1, Math.min(50, Math.round(input.currentAmount) || 5));
  const period = input.currentFrequency === 'opportunistic' ? 'weekly' : input.currentFrequency;
  const vault =
    input.currentSourceVault === 'fhenix' ||
    input.currentSourceVault === 'pooltogether' ||
    input.currentSourceVault === 'spark'
      ? input.currentSourceVault
      : 'spark';

  return {
    sourceVault: vault as VenicePolicyRecommendation['sourceVault'],
    period,
    maxSpendUsdc: amount.toFixed(2),
    ticketCount: Math.max(1, Math.min(20, amount)),
    rationale: [
      `Cap spend at $${amount.toFixed(2)} ${period} from ${vault} yield only.`,
      'Principal stays in the vault; tickets are funded from accrued yield.',
    ],
    warnings: ['Heuristic fallback — review before approving any MetaMask permission.'],
  };
}
