'use client';

import { Bot, Check, Loader, Sparkles, X } from 'lucide-react';
import { formatUnits, isAddress, type Address } from 'viem';
import { useReadContract } from 'wagmi';
import { Button } from '@/shared/components/ui/Button';
import { CompactCard } from '@/shared/components/premium/CompactLayout';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useXLayerAgent } from '@/hooks/useXLayerAgent';
import {
  XLAYER_HOOK_ABI,
  XLAYER_HOOK_IS_CONFIGURED,
  XLAYER_PRIZE_POOL_HOOK_ADDRESS,
  XLAYER_TESTNET_CHAIN_ID,
} from '@/config/xlayer';
import { getAgentTool, ensureXLayerToolsRegistered } from '@/services/agents/tools';
import type { XLayerKeeperPoolState } from '@/services/agents/veniceXLayerKeeper';

ensureXLayerToolsRegistered();

const HOOK = XLAYER_PRIZE_POOL_HOOK_ADDRESS as Address;
const configured = XLAYER_HOOK_IS_CONFIGURED && isAddress(HOOK);

function toUsdcNumber(value: bigint | undefined): number {
  if (value === undefined) return 0;
  return Number(formatUnits(value, 6));
}

const STATUS_STYLE: Record<string, string> = {
  proposed: 'bg-white/10 text-slate-300',
  approved: 'bg-cyan-500/20 text-cyan-200',
  rejected: 'bg-rose-500/20 text-rose-200',
  executing: 'bg-amber-500/20 text-amber-200',
  completed: 'bg-emerald-500/20 text-emerald-200',
  failed: 'bg-rose-500/20 text-rose-200',
};

export function XLayerAgentPanel({
  potBalance,
  totalShares,
  minPot,
  drawCooldown,
  surchargeBps,
  surchargeEnabled,
  drawState,
}: {
  potBalance: bigint | undefined;
  totalShares: bigint | undefined;
  minPot: bigint | undefined;
  drawCooldown: bigint | undefined;
  surchargeBps: number | undefined;
  surchargeEnabled: boolean | undefined;
  drawState:
    | readonly [
        boolean,
        boolean,
        boolean,
        boolean,
        bigint,
        bigint,
        bigint,
        bigint,
        Address,
        bigint,
      ]
    | undefined;
}) {
  const { address, chainId } = useUnifiedWallet();
  const agent = useXLayerAgent();

  const { data: lastDrawAt } = useReadContract({
    address: HOOK,
    abi: XLAYER_HOOK_ABI,
    functionName: 'lastDrawAt',
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: configured },
  });

  const buildPoolState = (): XLayerKeeperPoolState => {
    const last = lastDrawAt !== undefined ? Number(lastDrawAt as bigint) : 0;
    const secondsSinceLastDraw =
      last > 0 ? Math.max(0, Math.floor(Date.now() / 1000) - last) : null;
    const winner = drawState?.[8];
    return {
      potBalanceUsdc: toUsdcNumber(potBalance),
      totalShares: totalShares !== undefined ? Number(totalShares) : 0,
      minPotForDrawUsdc: toUsdcNumber(minPot),
      drawCooldownSeconds: drawCooldown !== undefined ? Number(drawCooldown) : 0,
      secondsSinceLastDraw,
      surchargeBps: surchargeBps ?? 100,
      surchargeEnabled: surchargeEnabled ?? true,
      drawOpen: Boolean(drawState?.[0]),
      drawResolved: Boolean(drawState?.[1]),
      drawClaimed: Boolean(drawState?.[2]),
      drawCancelled: Boolean(drawState?.[3]),
      epochId: Number(drawState?.[4] ?? 0n),
      connectedIsWinner: Boolean(
        address && winner && winner.toLowerCase() === address.toLowerCase(),
      ),
      oracleOwnerMatchesWallet: agent.oracleOwnerMatchesWallet,
    };
  };

  if (!configured) return null;

  const { loop, recommendation, planning, isExecuting } = agent;
  const hitlSteps =
    loop.plan?.steps.filter((s) => {
      const def = getAgentTool(s.toolId);
      return def?.requiresHitl;
    }) ?? [];

  return (
    <CompactCard variant="glass" padding="lg" hover={false} className="border-violet-400/20 bg-violet-500/[0.05]">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-violet-200">
        <Bot className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">X Layer agent loop</span>
        <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
          plan → HITL → execute → observe
        </span>
        <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
          {loop.status}
        </span>
      </div>

      <p className="mb-4 text-sm leading-6 text-slate-300">
        Venice (or a capped heuristic) proposes typed tools from the registry. You approve each
        mutating step; receipts close the loop. Surcharge advice stays timelock-aware.
      </p>

      <div className="mb-4 flex flex-wrap gap-2 text-[10px] text-slate-500">
        <span>session {loop.memory.sessionId.slice(-8)}</span>
        {loop.memory.lastTxHash && <span>last tx {loop.memory.lastTxHash.slice(0, 10)}…</span>}
        {loop.memory.epochId != null && <span>epoch {loop.memory.epochId}</span>}
        {chainId !== XLAYER_TESTNET_CHAIN_ID && (
          <span className="text-amber-300">switch to chain {XLAYER_TESTNET_CHAIN_ID} to execute</span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="glass"
          size="sm"
          className="border-violet-400/30"
          disabled={planning || isExecuting}
          onClick={() => agent.plan(buildPoolState())}
        >
          {planning ? (
            <>
              <Loader className="mr-2 h-3.5 w-3.5 animate-spin" />
              Planning…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Plan next actions
            </>
          )}
        </Button>
        {loop.plan && (
          <Button variant="glass" size="sm" onClick={agent.reset} disabled={isExecuting}>
            Reset session
          </Button>
        )}
      </div>

      {loop.error && <p className="mt-3 text-xs text-rose-300">{loop.error}</p>}

      {recommendation && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
          <p className="font-semibold text-white">
            Recommendation · {recommendation.action} · {recommendation.source}
          </p>
          <ul className="mt-2 space-y-1">
            {recommendation.rationale.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </div>
      )}

      {loop.plan && (
        <div className="mt-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Tool cards
          </p>
          {loop.plan.steps.map((step) => {
            const def = getAgentTool(step.toolId);
            const isHitl = Boolean(def?.requiresHitl);
            return (
              <div
                key={step.id}
                className="rounded-xl border border-white/10 bg-black/25 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{def?.label ?? step.toolId}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{def?.description}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[step.status] ?? STATUS_STYLE.proposed}`}>
                    {step.status}
                  </span>
                </div>
                {Object.keys(step.args).length > 0 && step.toolId !== 'xlayer.getPoolState' && (
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-white/[0.03] p-2 text-[10px] text-slate-400">
                    {JSON.stringify(step.args, null, 2)}
                  </pre>
                )}
                {step.result && (
                  <p className={`mt-2 text-xs ${step.result.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {step.result.message}
                    {step.result.transactionHash ? ` · ${step.result.transactionHash.slice(0, 10)}…` : ''}
                  </p>
                )}
                {step.error && !step.result && (
                  <p className="mt-2 text-xs text-rose-300">{step.error}</p>
                )}
                {isHitl && (step.status === 'proposed' || step.status === 'approved') && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step.status === 'proposed' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-cyan-600 text-white"
                          disabled={isExecuting}
                          onClick={() => agent.approve(step.id)}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="glass"
                          disabled={isExecuting}
                          onClick={() => agent.reject(step.id)}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </>
                    )}
                    {step.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white"
                        disabled={isExecuting}
                        onClick={() => agent.execute(step.id)}
                      >
                        {isExecuting ? (
                          <>
                            <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Signing…
                          </>
                        ) : (
                          'Execute (sign)'
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {loop.memory.history.length > 0 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Session memory
          </p>
          <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px] text-slate-500">
            {[...loop.memory.history].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`}>
                {h.kind}: {h.detail}
                {h.txHash ? ` · ${h.txHash.slice(0, 10)}…` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hitlSteps.length === 0 && loop.plan && recommendation?.action === 'wait' && (
        <p className="mt-4 text-xs text-slate-500">
          No mutating tools proposed — waiting is the correct keeper action.
        </p>
      )}
    </CompactCard>
  );
}
