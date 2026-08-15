'use client';

import { useState } from 'react';
import { Bot, Check, Loader, Sparkles, X } from 'lucide-react';
import { formatUnits, isAddress, type Address } from 'viem';
import { useReadContract } from 'wagmi';
import { Button } from '@/shared/components/ui/Button';
import { CompactCard } from '@/shared/components/premium/CompactLayout';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useXLayerAgent } from '@/hooks/useXLayerAgent';
import { useCapability } from '@/hooks/useCapability';
import {
  XLAYER_HOOK_ABI,
  XLAYER_HOOK_IS_CONFIGURED,
  XLAYER_PRIZE_POOL_HOOK_ADDRESS,
  XLAYER_TESTNET_CHAIN_ID,
  xLayerExplorerTx,
} from '@/config/xlayer';
import { getAgentTool, ensureXLayerToolsRegistered } from '@/services/agents/tools';
import { AgentSessionTranscript } from '@/components/xlayer/AgentSessionTranscript';
import { XLayerOperatorRunReplay } from '@/components/xlayer/XLayerOperatorRunReplay';
import type { AgentToolCall } from '@/services/agents/tools/types';
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

function ArgChips({ args, toolId }: { args: Record<string, unknown>; toolId: string }) {
  if (toolId === 'xlayer.getPoolState') return null;
  const entries = Object.entries(args).filter(([key]) => key !== 'snapshot');
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="max-w-full truncate rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300"
        >
          <span className="text-slate-500">{key}</span>{' '}
          <span className="font-medium text-white">{String(value)}</span>
        </span>
      ))}
    </div>
  );
}

function StepActions({
  step,
  isExecuting,
  onApprove,
  onReject,
  onExecute,
  fullWidth,
}: {
  step: AgentToolCall;
  isExecuting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onExecute: () => void;
  fullWidth?: boolean;
}) {
  const width = fullWidth ? 'w-full min-h-12 touch-manipulation' : 'min-h-11 touch-manipulation';
  if (step.status === 'proposed') {
    return (
      <div className={`mt-3 flex gap-2 ${fullWidth ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row'}`}>
        <Button
          size="sm"
          variant="default"
          className={`bg-cyan-600 text-white ${width} sm:flex-1`}
          disabled={isExecuting}
          onClick={onApprove}
        >
          <Check className="mr-1.5 h-4 w-4" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="glass"
          className={`${width} sm:flex-1`}
          disabled={isExecuting}
          onClick={onReject}
        >
          <X className="mr-1.5 h-4 w-4" />
          Reject
        </Button>
      </div>
    );
  }
  if (step.status === 'approved') {
    return (
      <div className="mt-3">
        <Button
          size="sm"
          variant="default"
          className={`bg-gradient-to-r from-violet-500 to-indigo-600 text-white ${width}`}
          disabled={isExecuting}
          onClick={onExecute}
        >
          {isExecuting ? (
            <>
              <Loader className="mr-1.5 h-4 w-4 animate-spin" />
              Signing…
            </>
          ) : (
            'Execute (sign in wallet)'
          )}
        </Button>
      </div>
    );
  }
  return null;
}

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
  const capability = useCapability('xlayer_prize_pool');
  const [tab, setTab] = useState<'steps' | 'transcript' | 'runs'>('steps');

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
      hookOwnerMatchesWallet: agent.hookOwnerMatchesWallet,
    };
  };

  if (!configured) return null;

  const { loop, recommendation, planning, isExecuting } = agent;
  const activeHitl = loop.plan?.steps.find((s) => {
    const def = getAgentTool(s.toolId);
    return def?.requiresHitl && (s.status === 'proposed' || s.status === 'approved');
  });
  const hitlDef = activeHitl ? getAgentTool(activeHitl.toolId) : null;

  return (
    <>
      <CompactCard
        variant="glass"
        padding="md"
        hover={false}
        className="hud border-cyan-400/20 bg-cyan-500/[0.04] sm:p-6"
      >
        <div className="mb-3 flex items-start gap-3 text-cyan-200 sm:mb-4">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] sm:text-[10px] sm:tracking-[0.2em]">
                Agent loop
              </span>
              <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-400 sm:text-[10px]">
                {loop.status}
              </span>
            </div>
            <p className="mt-1 hidden text-sm leading-6 text-slate-300 sm:block">
              Plan → approve → sign. Receipts close the loop; surcharge advice stays timelock-aware.
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-400 sm:hidden">
              Plan, approve, then sign. You stay in control.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>session …{loop.memory.sessionId.slice(-6)}</span>
          {loop.memory.lastTxHash && <span>tx {loop.memory.lastTxHash.slice(0, 8)}…</span>}
          {loop.memory.epochId != null && <span>epoch {loop.memory.epochId}</span>}
          {chainId !== XLAYER_TESTNET_CHAIN_ID && (
            <span className="font-medium text-amber-300">Switch to X Layer testnet to execute</span>
          )}
        </div>

        {/* Gates, disclosed up front — the transcript proves them */}
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            'HITL: manual approval',
            'Receipts required for success',
            `Write gate: ${capability.canWrite ? 'enabled' : 'disabled (demo)'}`,
            'Randomness: demo oracle (testnet)',
          ].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <Button
            variant="glass"
            size="sm"
            className="min-h-12 w-full touch-manipulation border-violet-400/30 sm:min-h-11 sm:w-auto"
            disabled={planning || isExecuting}
            onClick={() => agent.plan(buildPoolState())}
          >
            {planning ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Planning…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Plan next actions
              </>
            )}
          </Button>
          {loop.plan && (
            <Button
              variant="glass"
              size="sm"
              className="min-h-12 w-full touch-manipulation sm:min-h-11 sm:w-auto"
              onClick={agent.reset}
              disabled={isExecuting}
            >
              Reset session
            </Button>
          )}
        </div>

        {loop.error && <p className="mt-3 text-sm text-rose-300">{loop.error}</p>}

        {recommendation && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
            <p className="text-sm font-semibold text-white">
              {recommendation.action.replaceAll('_', ' ')}
              <span className="ml-2 text-xs font-normal text-slate-500">· {recommendation.source}</span>
            </p>
            <ul className="mt-2 space-y-1.5 text-sm leading-5 text-slate-300">
              {recommendation.rationale.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            {recommendation.warnings && recommendation.warnings.length > 0 && (
              <ul className="mt-2 space-y-1.5 border-t border-amber-500/20 pt-2 text-sm leading-5 text-amber-200/80">
                {recommendation.warnings.map((line) => (
                  <li key={line}>⚠ {line}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-2 border-b border-white/10 pb-3">
          {(
            [
              ['steps', 'Tools'],
              ['transcript', 'Transcript'],
              ['runs', 'Operator runs'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors touch-manipulation ${
                tab === t ? 'bg-violet-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'transcript' && (
          <div className="mt-4">
            <AgentSessionTranscript currentSessionId={loop.memory.sessionId} />
          </div>
        )}

        {tab === 'runs' && (
          <div className="mt-4">
            <XLayerOperatorRunReplay bare />
          </div>
        )}

        {tab === 'steps' && !loop.plan && (
          <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/30 p-5 font-mono">
            <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-400/60 mb-3">agent loop · ready</p>
            <p className="text-sm text-slate-300">
              <span className="text-cyan-400/70">$</span>{' '}
              <span className="text-slate-200">plan_next_actions</span>
              <span className="inline-block w-[9px] h-[1.1em] ml-0.5 bg-cyan-400/70 align-middle animate-cursor-blink" aria-hidden />
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Press <span className="text-white font-semibold">Plan next actions</span> — the tool cards
              appear here for your approval before anything executes.
            </p>
          </div>
        )}

        {tab === 'steps' && loop.plan && (
          <div className="mt-5 space-y-3 pb-20 sm:pb-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Tools</p>
            {loop.plan.steps.map((step) => {
              const def = getAgentTool(step.toolId);
              const isHitl = Boolean(def?.requiresHitl);
              return (
                <div key={step.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-white sm:text-sm">
                        {def?.label ?? step.toolId}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-slate-500 sm:text-[11px] sm:leading-5">
                        {def?.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[step.status] ?? STATUS_STYLE.proposed}`}
                    >
                      {step.status}
                    </span>
                  </div>
                  <ArgChips args={step.args} toolId={step.toolId} />
                  {step.result && (
                    <p className={`mt-2 text-sm ${step.result.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {step.result.message}
                      {step.result.transactionHash && (
                        <a
                          href={xLayerExplorerTx(step.result.transactionHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-300 hover:text-cyan-200"
                        >
                          {' '}· receipt {step.result.transactionHash.slice(0, 10)}…
                        </a>
                      )}
                    </p>
                  )}
                  {step.error && !step.result && (
                    <p className="mt-2 text-sm text-rose-300">{step.error}</p>
                  )}
                  {step.decidedAt && step.status !== 'proposed' && (
                    <p className="mt-1 text-[11px] text-slate-600">
                      HITL decision at {new Date(step.decidedAt).toLocaleTimeString()}
                      {step.completedAt ? ` · resolved ${new Date(step.completedAt).toLocaleTimeString()}` : ''}
                    </p>
                  )}
                  {isHitl && (step.status === 'proposed' || step.status === 'approved') && (
                    <div className="hidden sm:block">
                      <StepActions
                        step={step}
                        isExecuting={isExecuting}
                        onApprove={() => agent.approve(step.id)}
                        onReject={() => agent.reject(step.id)}
                        onExecute={() => agent.execute(step.id)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!activeHitl && loop.plan && recommendation?.action === 'wait' && (
          <p className="mt-4 text-sm text-slate-500">
            No mutating tools proposed — waiting is the correct keeper action.
          </p>
        )}
      </CompactCard>

      {/* Mobile sticky HITL bar */}
      {activeHitl && hitlDef && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-4 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl safe-bottom sm:hidden">
          <p className="mb-2 truncate text-xs text-slate-400">
            Next: <span className="font-semibold text-white">{hitlDef.label}</span>
            <span className="ml-2 text-slate-500">{activeHitl.status}</span>
          </p>
          <StepActions
            step={activeHitl}
            isExecuting={isExecuting}
            fullWidth
            onApprove={() => agent.approve(activeHitl.id)}
            onReject={() => agent.reject(activeHitl.id)}
            onExecute={() => agent.execute(activeHitl.id)}
          />
        </div>
      )}
    </>
  );
}
