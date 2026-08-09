'use client';

import { Bot, Loader, Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useBaseAgent } from '@/hooks/useBaseAgent';
import { usePermissionedAutopilotPolicies } from '@/hooks';
import { ensureBaseToolsRegistered, getAgentTool } from '@/services/agents/tools';
import { getCapability } from '@/config/capabilities';

ensureBaseToolsRegistered();

const STATUS_STYLE: Record<string, string> = {
  proposed: 'bg-slate-100 text-slate-600',
  completed: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-rose-50 text-rose-700',
  approved: 'bg-cyan-50 text-cyan-700',
  rejected: 'bg-rose-50 text-rose-700',
  executing: 'bg-amber-50 text-amber-700',
};

/**
 * Thin Base product-home agent strip — same tool registry pattern as X Layer,
 * advisory only until the user approves a MetaMask policy.
 */
export function BaseAgentPanel() {
  const cap = getCapability('automation_erc7715');
  const { activePolicies } = usePermissionedAutopilotPolicies();
  const agent = useBaseAgent();

  if (!cap.readsEnabled) return null;

  const primary = activePolicies[0];
  const maxSpendUsdc = primary
    ? Number(BigInt(primary.maxSpendPerPeriod)) / 1_000_000
    : 5;
  const ticketCount = primary?.ticketCount ?? 5;
  const sourceVault = primary?.sourceVault ?? 'spark';
  const period = primary?.period === 'monthly' ? 'monthly' : 'weekly';
  const demoYield = Number(process.env.NEXT_PUBLIC_YIELD_AUTOPILOT_DEMO_YIELD_USDC ?? 0) || 3;

  return (
    <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-gray-900">Base agent tools</h4>
            <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              {agent.loop.status}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            Plan yield spend on Base. MetaMask permission approval stays the write boundary — same
            registry pattern as the X Layer demo.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="sm"
          variant="outline"
          className="min-h-11 border-indigo-200 text-indigo-800 touch-manipulation"
          disabled={agent.planning}
          onClick={() =>
            agent.plan({
              yieldUsdc: demoYield,
              maxSpendUsdc,
              ticketCount,
              sourceVault,
              policyId: primary?.id ?? null,
              period,
              includeAdvice: true,
              currentAmount: maxSpendUsdc,
              currentFrequency: period,
            })
          }
        >
          {agent.planning ? (
            <>
              <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Planning…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Plan yield tools
            </>
          )}
        </Button>
        {agent.loop.plan && (
          <Button size="sm" variant="ghost" className="min-h-11" onClick={agent.reset}>
            Reset
          </Button>
        )}
      </div>

      {agent.loop.error && <p className="text-xs text-rose-600">{agent.loop.error}</p>}

      {agent.loop.plan && (
        <ul className="space-y-2">
          {agent.loop.plan.steps.map((step) => {
            const def = getAgentTool(step.toolId);
            return (
              <li
                key={step.id}
                className="rounded-lg border border-white bg-white/80 px-3 py-2.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{def?.label ?? step.toolId}</p>
                    {step.result && (
                      <p className="mt-1 text-xs leading-5 text-gray-600">{step.result.message}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[step.status] ?? STATUS_STYLE.proposed}`}
                  >
                    {step.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] leading-4 text-gray-500">
        Base remains the product home. Use Settings → yield autopilot to approve a capped policy.
      </p>
    </div>
  );
}
