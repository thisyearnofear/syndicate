/**
 * Single resolver for Base autopilot policy advice (Venice → heuristic).
 * Used by /api/agent/base/plan and the thin /api/agent/autopilot/advice wrapper.
 */

import { FEATURES } from '@/config';
import {
  type VenicePolicyAdvisorInput,
  type VenicePolicyRecommendation,
  venicePolicyAdvisor,
} from '@/services/agents/venicePolicyAdvisor';
import { buildHeuristicAutopilotAdvice } from '@/services/agents/loop/baseAgentPlan';

export type ResolvedAutopilotAdvice = Pick<
  VenicePolicyRecommendation,
  | 'sourceVault'
  | 'mode'
  | 'period'
  | 'maxSpendUsdc'
  | 'ticketCount'
  | 'preservePrincipal'
  | 'relayer'
  | 'rationale'
  | 'warnings'
>;

export async function resolveAutopilotAdvice(
  input: VenicePolicyAdvisorInput,
): Promise<{ recommendation: ResolvedAutopilotAdvice; source: 'venice' | 'heuristic' }> {
  if (FEATURES.enableVeniceAdvisor && venicePolicyAdvisor.isConfigured()) {
    try {
      const recommendation = await venicePolicyAdvisor.recommend(input);
      return { recommendation, source: 'venice' };
    } catch {
      // fall through to heuristic
    }
  }

  const heuristic = buildHeuristicAutopilotAdvice({
    currentAmount: input.currentAmount,
    currentFrequency: input.currentFrequency,
    currentSourceVault: input.currentSourceVault,
  });

  return {
    recommendation: {
      ...heuristic,
      mode: 'yield-autopilot',
      preservePrincipal: true,
      relayer: '1shot',
    },
    source: 'heuristic',
  };
}
