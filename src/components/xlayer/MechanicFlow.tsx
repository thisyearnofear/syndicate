'use client';

/**
 * MECHANIC FLOW — teaches the v4 hook in one glance.
 *
 * Three nodes (Swap · Prize Pot · Winner), two arrows. The surcharge
 * arrow carries an animated traveling dot on a 2.4s loop so the eye
 * learns "swaps fill the pot" without reading anything. A second
 * dashed arrow from Pot → Winner fires only when a draw is live
 * (orbState resolving/settled).
 *
 * All CSS-only, no JS animation, transform/opacity composited.
 * Respects prefers-reduced-motion: dot vanishes, nodes are static.
 *
 * Sits below the orb/prize figure in XLayerPoolStage, replacing the
 * flat chip row. The surcharge rate is live from on-chain (surchargeBps).
 */

import type { RoundOrbState } from '@/components/motion/RoundOrb';

interface MechanicFlowProps {
  surchargeBps: number | undefined;
  orbState: RoundOrbState;
  potBalance: bigint | undefined;
  minPotForDraw: bigint | undefined;
}

function FlowNode({
  label,
  sublabel,
  accent = false,
  live = false,
}: {
  label: string;
  sublabel?: string;
  accent?: boolean;
  live?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-2 min-w-[72px] text-center transition-colors ${
        live
          ? 'border-emerald-400/50 bg-emerald-500/10'
          : accent
            ? 'border-cyan-400/30 bg-cyan-500/10'
            : 'border-white/10 bg-white/[0.04]'
      }`}
    >
      <span
        className={`font-mono text-[11px] font-bold ${
          live ? 'text-emerald-200' : accent ? 'text-cyan-200' : 'text-slate-300'
        }`}
      >
        {label}
      </span>
      {sublabel && (
        <span className="font-mono text-[10px] text-slate-500">{sublabel}</span>
      )}
    </div>
  );
}

/** Arrow with optional traveling dot. `dashed` = potential, not live flow. */
function FlowArrow({
  label,
  animated = false,
  dashed = false,
  delay = '0s',
}: {
  label?: string;
  animated?: boolean;
  dashed?: boolean;
  delay?: string;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-0.5 min-w-[40px]">
      {/* Track line */}
      <div
        className={`relative h-px w-full ${
          dashed ? 'border-t border-dashed border-white/15' : 'bg-white/15'
        }`}
      >
        {/* Arrowhead */}
        <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[1px] text-slate-500 text-[10px] leading-none select-none">
          ›
        </span>
        {/* Traveling dot — only when animated */}
        {animated && (
          <span
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)] animate-dot-travel motion-reduce:hidden"
            style={{ animationDelay: delay }}
          />
        )}
      </div>
      {label && (
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600 whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  );
}

const formatUsdc = (v: bigint) =>
  (Number(v) / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function MechanicFlow({
  surchargeBps,
  orbState,
  potBalance,
  minPotForDraw,
}: MechanicFlowProps) {
  const surchargeLabel =
    surchargeBps !== undefined ? `${surchargeBps / 100}% fee` : '1% fee';

  const drawLive = orbState === 'resolving' || orbState === 'settled';

  // Progress toward min pot (capped 0–100)
  const progress =
    potBalance !== undefined && minPotForDraw !== undefined && minPotForDraw > 0n
      ? Math.min(100, Math.round((Number(potBalance) / Number(minPotForDraw)) * 100))
      : null;

  return (
    <div className="space-y-2">
      {/* Node row */}
      <div className="flex items-center gap-1">
        {/* Node: Swap */}
        <FlowNode label="Swap" sublabel="any trade" accent />

        {/* Arrow: surcharge siphons into pot — always animated */}
        <FlowArrow label={surchargeLabel} animated delay="0s" />

        {/* Node: Prize Pot */}
        <FlowNode
          label="Prize Pot"
          sublabel={potBalance !== undefined ? formatUsdc(potBalance) : '—'}
          accent
        />

        {/* Arrow: draw resolution — dashed until a draw is live */}
        <FlowArrow label="draw" animated={drawLive} dashed={!drawLive} delay="1.2s" />

        {/* Node: Winner */}
        <FlowNode label="Winner" sublabel="weighted odds" live={drawLive} />
      </div>

      {/* Principal safety line */}
      <p className="font-mono text-[10px] text-slate-500 text-center tracking-[0.08em]">
        your principal stays in the contract · always redeemable between draws
      </p>

      {/* Pot fill progress bar — shows when min is configured */}
      {progress !== null && (
        <div className="space-y-1">
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-400 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="font-mono text-[10px] text-slate-600 text-right">
            {progress}% toward draw minimum
            {minPotForDraw !== undefined && minPotForDraw > 0n
              ? ` (${formatUsdc(minPotForDraw)} USDC)`
              : ''}
          </p>
        </div>
      )}
    </div>
  );
}
