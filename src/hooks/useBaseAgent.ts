/**
 * useBaseAgent — Base yield/autopilot adapters over the shared agent loop binder.
 *
 * Advisory loop only: MetaMask permission approval remains the write boundary.
 */

'use client';

import { useCallback, useState } from 'react';
import { useAgentLoop } from '@/hooks/useAgentLoop';
import { ensureBaseToolsRegistered } from '@/services/agents/tools';
import type { AgentPlan, AgentToolCall, AgentToolResult } from '@/services/agents/tools/types';

ensureBaseToolsRegistered();

export interface BaseAgentPlanRequest {
  yieldUsdc: number;
  maxSpendUsdc: number;
  ticketCount: number;
  sourceVault: string;
  policyId?: string | null;
  period?: 'weekly' | 'monthly' | 'opportunistic';
  includeAdvice?: boolean;
  currentAmount?: number;
  currentFrequency?: 'weekly' | 'monthly' | 'opportunistic';
  riskPreference?: 'conservative' | 'balanced' | 'active';
  wantsPrivacy?: boolean;
  walletType?: string | null;
  preservePrincipal?: boolean;
}

export function useBaseAgent() {
  const {
    loop,
    planning,
    applyFetchedPlan,
    failPlan,
    withPlanning,
    reset: resetLoop,
  } = useAgentLoop();
  const [advice, setAdvice] = useState<Record<string, unknown> | null>(null);

  const runReadOnly = useCallback((step: AgentToolCall): AgentToolResult => {
    if (step.toolId === 'base.getYieldSnapshot') {
      return {
        ok: true,
        message: `Yield snapshot: ${String(step.args.yieldUsdc)} USDC available on ${String(step.args.sourceVault)}.`,
        data: step.args,
      };
    }
    if (step.toolId === 'base.planYieldSpend') {
      return {
        ok: true,
        message: String(step.args.message ?? 'Yield spend planned.'),
        data: step.args,
      };
    }
    if (step.toolId === 'base.proposeAutopilotPolicy') {
      return {
        ok: true,
        message: `Suggested ${String(step.args.ticketCount)} tickets / $${String(step.args.maxSpendUsdc)} ${String(step.args.period)} from ${String(step.args.sourceVault)}.`,
        data: step.args,
      };
    }
    return { ok: false, message: `Not a Base read-only tool: ${step.toolId}` };
  }, []);

  const plan = useCallback(
    async (input: BaseAgentPlanRequest) => {
      await withPlanning(async () => {
        try {
          const res = await fetch('/api/agent/base/plan', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(input),
          });
          const body = (await res.json()) as {
            success?: boolean;
            plan?: AgentPlan;
            advice?: Record<string, unknown> | null;
            recommendation?: Record<string, unknown> | null;
            error?: string;
          };
          if (!res.ok || !body.success || !body.plan) {
            throw new Error(body.error ?? 'Base plan failed');
          }
          setAdvice(body.advice ?? body.recommendation ?? null);
          applyFetchedPlan(body.plan, runReadOnly);
        } catch (err) {
          failPlan(err instanceof Error ? err.message : 'Base plan failed');
        }
      });
    },
    [applyFetchedPlan, failPlan, runReadOnly, withPlanning],
  );

  const reset = useCallback(() => {
    resetLoop();
    setAdvice(null);
  }, [resetLoop]);

  return {
    loop,
    advice,
    planning,
    plan,
    reset,
  };
}
