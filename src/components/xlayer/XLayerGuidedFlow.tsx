'use client';

/**
 * GUIDED FLOW — the interactive spine of /xlayer.
 *
 * One ordered walkthrough a stranger completes top to bottom: connect →
 * switch chain → faucet funds → shares → agent. Progressive disclosure:
 * completed steps collapse to a checked line, future steps show only a
 * dimmed title, and exactly one step — the next action — is ever open.
 * Each step auto-checks from live on-chain state (12s polling upstream).
 *
 * Honesty contract preserved: when writes are gated (read-only deployment)
 * the share step says so instead of hiding; faucet friction is surfaced as
 * a step, not discovered via a reverting transaction.
 */

import { useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  ExternalLink,
  Loader,
  Sparkles,
} from 'lucide-react';
import { formatUnits } from 'viem';
import { Button } from '@/shared/components/ui/Button';
import { useCapability } from '@/hooks/useCapability';
import { useXLayerDeposit, useXLayerJoin } from '@/services/xlayer';
import { XLAYER_FAUCET_URL } from '@/config/xlayer';

export interface XLayerGuidedFlowProps {
  isConnected: boolean;
  onConnect: () => Promise<void>;
  activeOnXLayer: boolean;
  onSwitch: () => Promise<void>;
  /** Native OKB balance (gas), null while unknown. */
  nativeBalance: number | null;
  /** USDC_TEST balance, null while unknown. */
  usdcBalance: number | null;
  userShares: bigint | undefined;
  drawOpen: boolean;
  drawResolved: boolean;
  drawClaimed: boolean;
}

function StepShell({
  index,
  title,
  done,
  active,
  children,
  doneContent,
}: {
  index: number;
  title: string;
  done: boolean;
  /** The one open step. Future steps render a dimmed title only. */
  active: boolean;
  children?: React.ReactNode;
  /** Optional compressed content shown after completion (e.g. add-more). */
  doneContent?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 px-1 py-3 first:pt-0.5">
      <span className="mt-0.5 shrink-0">
        {done ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          </span>
        ) : (
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold ${
              active ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200' : 'border-white/10 text-slate-600'
            }`}
          >
            {index}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${
            done ? 'text-emerald-200' : active ? 'text-white' : 'text-slate-500'
          }`}
        >
          {title}
        </p>
        {done && doneContent}
        {!done && active && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}

function FundsHint({
  usdcBalance,
  nativeBalance,
}: {
  usdcBalance: number | null;
  nativeBalance: number | null;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
      <span>
        Balance:{' '}
        {usdcBalance === null
          ? '—'
          : `${usdcBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC_TEST`}
        {nativeBalance !== null &&
          ` · ${nativeBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} OKB`}
      </span>
      <span aria-hidden>·</span>
      <a
        href={XLAYER_FAUCET_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center gap-1 font-semibold text-cyan-300 transition hover:text-cyan-200 touch-manipulation sm:min-h-0"
      >
        Claim testnet OKB + USDC <ExternalLink className="h-3 w-3" />
      </a>
    </p>
  );
}

/** Inline share forms — deposit is the default path, swap is the advanced one. */
function ShareForms({
  usdcBalance,
  nativeBalance,
}: {
  usdcBalance: number | null;
  nativeBalance: number | null;
}) {
  const { canWrite, message } = useCapability('xlayer_prize_pool');
  const depositTx = useXLayerDeposit();
  const joinTx = useXLayerJoin();
  const [amount, setAmount] = useState('5');
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [joinAmount, setJoinAmount] = useState('10');
  const [joinError, setJoinError] = useState<string | null>(null);

  if (!canWrite) {
    return (
      <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">
        {message ?? 'This deployment is read-only — deposits and swaps are gated off by the operator.'}{' '}
        You can still watch the operator run below.
      </p>
    );
  }

  const handleDeposit = async () => {
    setError(null);
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      setError('Enter a valid USDC amount');
      return;
    }
    if (usdcBalance !== null && parsed > usdcBalance) {
      setError('Not enough testnet USDC — claim USDC_TEST from the faucet above.');
      return;
    }
    const result = await depositTx.deposit({ amountUsdc: amount });
    if (!result.success && result.error) setError(result.error);
  };

  const handleJoin = async () => {
    setJoinError(null);
    const parsed = parseFloat(joinAmount);
    if (!parsed || parsed <= 0) {
      setJoinError('Enter a valid USDC amount');
      return;
    }
    if (usdcBalance !== null && parsed > usdcBalance) {
      setJoinError('Not enough testnet USDC — claim USDC_TEST from the faucet above.');
      return;
    }
    const result = await joinTx.join({ amountUsdc: joinAmount });
    if (!result.success && result.error) setJoinError(result.error);
  };

  return (
    <div className="space-y-3">
      <FundsHint usdcBalance={usdcBalance} nativeBalance={nativeBalance} />
      {message && <p className="text-xs text-amber-300/80">{message}</p>}

      {depositTx.isSuccess ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] p-3">
          <p className="text-sm font-semibold text-emerald-200">Principal deposited</p>
          <p className="mt-1 text-xs text-slate-400">
            Shares are active for draw eligibility. The agent handles the rest.
          </p>
          <Button variant="glass" size="sm" className="mt-3" onClick={depositTx.reset}>
            Deposit again
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-400">Amount (USDC)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={depositTx.isActive}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base text-white focus:border-cyan-400/50 focus:outline-none disabled:opacity-50 sm:py-2 sm:text-sm"
                placeholder="5.00"
              />
            </div>
            <Button
              variant="default"
              size="sm"
              className="min-h-12 w-full bg-gradient-to-r from-cyan-500 to-blue-600 px-6 text-white touch-manipulation sm:min-h-11 sm:w-auto"
              onClick={handleDeposit}
              disabled={depositTx.isActive}
            >
              {depositTx.isActive ? (
                <>
                  <Loader className="mr-1.5 h-3 w-3 animate-spin" />
                  Depositing…
                </>
              ) : (
                'Deposit'
              )}
            </Button>
          </div>
          {error && (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
          {depositTx.isError &&
            depositTx.execution.status === 'failed' &&
            !depositTx.execution.error.userCancelled && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-300"
                onClick={() => {
                  depositTx.reset();
                  setError(null);
                }}
              >
                Try again
              </Button>
            )}
        </>
      )}

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-slate-400 transition hover:text-white touch-manipulation sm:min-h-0 sm:py-2"
        aria-expanded={showAdvanced}
      >
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
          Advanced: join via swap instead (surcharge feeds the pot)
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>

      {showAdvanced && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3">
          {joinTx.isSuccess ? (
            <div>
              <p className="text-sm font-semibold text-emerald-200">Joined via swap</p>
              <p className="mt-1 text-xs text-slate-400">Shares + surcharge contribution confirmed.</p>
              <Button variant="glass" size="sm" className="mt-3" onClick={joinTx.reset}>
                Swap again
              </Button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs leading-5 text-slate-400">
                Route a USDC swap through the prize-pool router. The surcharge accrues to the pot; you receive shares.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-400">Amount (USDC)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={joinAmount}
                    onChange={(e) => setJoinAmount(e.target.value)}
                    disabled={joinTx.isActive}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base text-white focus:border-emerald-400/50 focus:outline-none disabled:opacity-50 sm:py-2 sm:text-sm"
                    placeholder="10.00"
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="min-h-12 w-full bg-gradient-to-r from-emerald-500 to-teal-600 px-6 text-white touch-manipulation hover:from-emerald-600 hover:to-teal-700 sm:min-h-11 sm:w-auto"
                  onClick={handleJoin}
                  disabled={joinTx.isActive}
                >
                  {joinTx.isActive ? (
                    <>
                      <Loader className="mr-1.5 h-3 w-3 animate-spin" />
                      Joining…
                    </>
                  ) : (
                    'Join via swap'
                  )}
                </Button>
              </div>
              {joinError && (
                <p className="mt-2 text-xs text-red-400" role="alert">
                  {joinError}
                </p>
              )}
              {joinTx.isError &&
                joinTx.execution.status === 'failed' &&
                !joinTx.execution.error.userCancelled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-red-300"
                    onClick={() => {
                      joinTx.reset();
                      setJoinError(null);
                    }}
                  >
                    Try again
                  </Button>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function XLayerGuidedFlow({
  isConnected,
  onConnect,
  activeOnXLayer,
  onSwitch,
  nativeBalance,
  usdcBalance,
  userShares,
  drawOpen,
  drawResolved,
  drawClaimed,
}: XLayerGuidedFlowProps) {
  const [busy, setBusy] = useState<'connect' | 'switch' | null>(null);
  const [addMore, setAddMore] = useState(false);

  const hasShares = Boolean(userShares && userShares > 0n);
  const hasFunds =
    usdcBalance !== null && usdcBalance > 0 && (nativeBalance === null || nativeBalance > 0);

  // The four onboarding steps drive the counter; the agent step is the
  // standing invitation once you're ready (it never "completes").
  const steps = [{ done: isConnected }, { done: activeOnXLayer }, { done: hasFunds }, { done: hasShares }];
  const doneCount = steps.filter((s) => s.done).length;
  const activeIndex = steps.findIndex((s) => !s.done);
  const readyForAgent = activeIndex === -1;

  const handleConnect = async () => {
    setBusy('connect');
    try {
      await onConnect();
    } finally {
      setBusy(null);
    }
  };
  const handleSwitch = async () => {
    setBusy('switch');
    try {
      await onSwitch();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Get started with the pool">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Try the loop</p>
        <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
          {readyForAgent ? 'Ready' : `${doneCount}/4`}
        </span>
      </div>

      <ol className="divide-y divide-white/[0.06]">
        <StepShell index={1} title="Connect an EVM wallet" done={isConnected} active={activeIndex === 0}>
          <Button
            variant="default"
            size="sm"
            className="min-h-11 bg-cyan-600 px-5 text-white touch-manipulation"
            onClick={handleConnect}
            disabled={busy !== null}
          >
            {busy === 'connect' ? <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Connect wallet
          </Button>
        </StepShell>

        <StepShell index={2} title="Switch to X Layer testnet (1952)" done={activeOnXLayer} active={activeIndex === 1}>
          <Button
            variant="glass"
            size="sm"
            className="min-h-11 border-cyan-400/30 touch-manipulation"
            onClick={handleSwitch}
            disabled={busy !== null}
          >
            {busy === 'switch' ? <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Switch network
          </Button>
        </StepShell>

        <StepShell index={3} title="Get testnet funds" done={hasFunds} active={activeIndex === 2}>
          <div className="space-y-1">
            <FundsHint usdcBalance={usdcBalance} nativeBalance={nativeBalance} />
            <p className="text-[11px] leading-4 text-slate-600">
              OKB pays gas; USDC_TEST is the deposit token. Both come from the official faucet.
            </p>
          </div>
        </StepShell>

        <StepShell
          index={4}
          title="Get shares (principal stays redeemable)"
          done={hasShares}
          active={activeIndex === 3}
          doneContent={
            <div className="mt-1">
              <p className="text-xs text-slate-500">
                {formatUnits(userShares ?? 0n, 6)} shares held.
              </p>
              <button
                type="button"
                onClick={() => setAddMore((v) => !v)}
                className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200 touch-manipulation sm:min-h-0"
                aria-expanded={addMore}
              >
                {addMore ? 'Hide deposit' : 'Deposit more'}
                <ChevronDown className={`h-3 w-3 transition-transform ${addMore ? 'rotate-180' : ''}`} />
              </button>
              {addMore && (
                <div className="mt-2">
                  <ShareForms usdcBalance={usdcBalance} nativeBalance={nativeBalance} />
                </div>
              )}
            </div>
          }
        >
          <ShareForms usdcBalance={usdcBalance} nativeBalance={nativeBalance} />
        </StepShell>

        <StepShell index={5} title="Watch the agent run the draw" done={false} active={readyForAgent}>
          <div className="space-y-2">
            <p className="text-xs leading-5 text-slate-400">
              Plan → approve → sign. A scheduled operator run keeps epochs moving too — its public
              transcript is below the panel.
            </p>
            <a
              href="#xlayer-agent-panel"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20 touch-manipulation sm:min-h-0 sm:py-2"
            >
              <Bot className="h-3.5 w-3.5" />
              Go to the agent panel
            </a>
            {(drawOpen || drawResolved || drawClaimed) && (
              <p className="text-[11px] text-emerald-300/80">
                {drawOpen
                  ? 'An epoch is resolving right now — the orb above is flickering.'
                  : drawResolved && !drawClaimed
                    ? 'The current epoch is resolved and awaiting the winner claim.'
                    : 'The pool is between epochs — the keeper opens the next one.'}
              </p>
            )}
          </div>
        </StepShell>
      </ol>
    </section>
  );
}
