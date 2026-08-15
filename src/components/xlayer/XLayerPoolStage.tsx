'use client';

/**
 * POOL STAGE — the /xlayer hero is the pool itself, not a card about it.
 *
 * One stage, three depths: a layered parallax field behind (blur orbs
 * drifting at different rates), the RoundOrb at hero scale carrying epoch
 * state, then the on-chain figures in real hero typography. The signature
 * moment is the epoch resolve: when polling observes draw-open → resolved,
 * the orb settles and the winner strip clip-reveals outward from the same
 * point (globals.css .clip-reveal). Motion fires only on state change —
 * the reveal grammar, not decoration.
 */

import { useEffect, useRef, useState } from 'react';
import { isAddress, type Address } from 'viem';
import { RoundOrb, type RoundOrbState } from '@/components/motion/RoundOrb';
import { BeamFrame } from '@/components/motion/BeamFrame';
import { CountUp } from '@/components/motion/CountUp';
import { MechanicFlow } from '@/components/xlayer/MechanicFlow';
import { ACCENTS } from '@/config/design';

export interface XLayerPoolStageProps {
  potBalance: bigint | undefined;
  minPotForDraw: bigint | undefined;
  totalShares: bigint | undefined;
  drawCooldown: bigint | undefined;
  surchargeBps: number | undefined;
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
  evmAddress: Address | undefined;
  userShares: bigint | undefined;
  userPrincipal: bigint | undefined;
  shareOdds: string;
}

const formatUsdc = (value: bigint | undefined) => {
  if (value === undefined) return '—';
  return (Number(value) / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const shorten = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

export function XLayerPoolStage({
  potBalance,
  minPotForDraw,
  totalShares,
  drawCooldown: _drawCooldown,
  surchargeBps,
  drawState,
  evmAddress,
  userShares,
  userPrincipal,
  shareOdds,
}: XLayerPoolStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  // Layered depth: each background field drifts with scroll at its own
  // rate. Transform-only, rAF-throttled, one shared CSS variable.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, rect.top / window.innerHeight));
        el.style.setProperty('--stage-scroll', progress.toFixed(3));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Resolve choreography: only when polling observes the actual
  // transition does the winner strip clip-reveal (fresh mounts render
  // it statically).
  const prevRef = useRef<{ open: boolean; resolved: boolean; claimed: boolean; pot: bigint } | null>(null);
  const [revealKey, setRevealKey] = useState(0);

  // Pot-fill delta flash: track balance changes between polls.
  const [deltaUsdc, setDeltaUsdc] = useState<number | null>(null);
  const [deltaKey, setDeltaKey] = useState(0);

  const drawOpen = Boolean(drawState?.[0]);
  const drawResolved = Boolean(drawState?.[1]);
  const drawClaimed = Boolean(drawState?.[2]);
  const drawCancelled = Boolean(drawState?.[3]);
  const winner = drawState?.[8];

  useEffect(() => {
    const prev = prevRef.current;
    const currentPot = potBalance ?? 0n;
    prevRef.current = { open: drawOpen, resolved: drawResolved, claimed: drawClaimed, pot: currentPot };
    if (!prev) return;

    // Resolve animation
    if (prev.open && !prev.resolved && drawResolved && !drawClaimed) {
      setRevealKey((k) => k + 1);
    }

    // Pot-fill delta flash: only when balance grew (surcharge accrued)
    if (currentPot > prev.pot && !drawOpen) {
      const delta = Number(currentPot - prev.pot) / 1e6;
      if (delta >= 0.001) {
        setDeltaUsdc(delta);
        setDeltaKey((k) => k + 1);
      }
    }
  }, [drawOpen, drawResolved, drawClaimed, potBalance]);

  const orbState: RoundOrbState = !drawState
    ? 'idle'
    : drawOpen
      ? 'resolving'
      : drawResolved && !drawClaimed
        ? 'settled'
        : drawCancelled
          ? 'idle'
          : 'active';

  // Rich contextual status — replaces flat "Open for entries"
  const potUsdcNum = potBalance !== undefined ? Number(potBalance) / 1e6 : null;
  const minUsdcNum = minPotForDraw !== undefined && minPotForDraw > 0n ? Number(minPotForDraw) / 1e6 : null;

  const statusLine = !drawState
    ? 'Collecting surcharges — pot filling'
    : drawOpen
      ? 'Draw in progress — randomness resolving'
      : drawResolved && !drawClaimed
        ? `Epoch ${drawState[4].toString()} won — winner can claim ${formatUsdc(drawState[7])}`
        : drawCancelled
          ? 'Draw cancelled — pot carries to next epoch'
          : potUsdcNum !== null && minUsdcNum !== null && potUsdcNum < minUsdcNum
            ? `Pot at ${formatUsdc(potBalance)} · ${Math.round((potUsdcNum / minUsdcNum) * 100)}% toward draw`
            : `Pot ready · ${formatUsdc(totalShares)} total shares · draw eligible`;

  const winnerIsYou = Boolean(
    evmAddress && winner && isAddress(winner) && winner.toLowerCase() === evmAddress.toLowerCase(),
  );

  const potAsNumber = potBalance !== undefined ? Number(potBalance) / 1e6 : 0;

  return (
    <div
      ref={stageRef}
      className="hud relative overflow-hidden rounded-2xl p-6 sm:p-8"
    >
      {/* Parallax depth field — three rates, transform-only */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl animate-float"
          style={{
            animationDuration: '11s',
            transform: 'translateY(calc(var(--stage-scroll, 0) * 28px))',
          }}
        />
        <div
          className="absolute -right-20 top-1/4 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl animate-float"
          style={{
            animationDuration: '15s',
            transform: 'translateY(calc(var(--stage-scroll, 0) * 52px))',
          }}
        />
        <div
          className="absolute bottom-[-30%] left-1/3 h-56 w-56 rounded-full bg-teal-300/10 blur-3xl"
          style={{ transform: 'translateY(calc(var(--stage-scroll, 0) * 16px))' }}
        />
      </div>

      <div className="relative">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <div className="relative shrink-0">
              {/* Breathing halo: pulses slowly when the pool is alive but waiting */}
              <div
                className={`absolute -inset-3 rounded-full blur-xl ${
                  orbState === 'idle' || orbState === 'active'
                    ? 'bg-cyan-400/10 animate-orb-breathe'
                    : orbState === 'resolving'
                      ? 'bg-cyan-400/20 animate-pulse'
                      : 'bg-cyan-400/10'
                }`}
              />
              <RoundOrb state={orbState} size={96} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                {drawState ? `Epoch ${drawState[4].toString()}` : 'No live epoch'}
              </p>
              <p className="mt-1.5 text-sm text-slate-300">{statusLine}</p>
            </div>
          </div>

          {/* Prize pot figure with delta flash */}
          <div className="relative shrink-0 sm:text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Prize pot</p>
            <p className={`mt-1 font-mono text-6xl font-semibold tabular-nums tracking-tight md:text-7xl ${ACCENTS.experimental.gradientText}`}>
              <CountUp value={potAsNumber} decimals={2} durationMs={700} />
            </p>
            <p className="mt-1 text-xs text-slate-500">USDC_TEST</p>
            {/* Delta flash chip — animates in when surcharge accrues */}
            {deltaUsdc !== null && (
              <span
                key={deltaKey}
                className="absolute -right-1 -top-1 rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300 animate-delta-rise pointer-events-none"
              >
                +{deltaUsdc.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        {drawResolved && !drawClaimed && winner && (
          <div className="mt-6">
            <BeamFrame color="#34d399" laps={2} duration={4} className="block w-full">
              <div
                key={revealKey}
                className={`w-full rounded-2xl bg-slate-950/70 px-4 py-3 ${revealKey > 0 ? 'lab-resolve' : ''}`}
              >
                <p className="text-sm font-semibold text-emerald-200">
                  Epoch {drawState?.[4].toString()} resolved{' '}
                  {winnerIsYou ? '— you won the pot' : `— winner ${shorten(winner)}`}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {winnerIsYou
                    ? 'Claim from the agent panel below — receipts close the loop.'
                    : 'Waiting on the winner to claim. Principal shares are unaffected.'}
                </p>
              </div>
            </BeamFrame>
          </div>
        )}

        {/* Mechanic flow diagram — teaches the v4 hook in one glance */}
        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <MechanicFlow
            surchargeBps={surchargeBps}
            orbState={orbState}
            potBalance={potBalance}
            minPotForDraw={minPotForDraw}
          />
        </div>

        {/* Your position chip */}
        {evmAddress && (
          <div className="mt-4">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
              You: {formatUsdc(userShares)} shares · {shareOdds} odds
              {userPrincipal ? ` · ${formatUsdc(userPrincipal)} principal` : ''}
            </span>
          </div>
        )}
        {!evmAddress && (
          <p className="mt-4 text-[11px] text-slate-600">Connect to see your position</p>
        )}
      </div>
    </div>
  );
}
