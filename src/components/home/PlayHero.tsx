"use client";

/**
 * PLAY HERO — the only pitch on `/`.
 *
 * One figure (live pot), one CTA (Enter draw), one mechanism line.
 * Proof lives in ProofStrip below — never a fake "verified" microline
 * without a settlement hash. Play accent + Inter only.
 */

import { Clock } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { BeamFrame } from "@/components/motion/BeamFrame";
import { RoundOrb, type RoundOrbState } from "@/components/motion/RoundOrb";
import { ACCENTS } from "@/config/design";

interface PlayHeroProps {
  prizeDisplay: string | null;
  orbState: RoundOrbState;
  drawId?: number | null;
  countdownLabel?: string | null;
  countdownUrgent?: boolean;
  oddsDisplay?: string | null;
  onEnter: () => void;
}

export function PlayHero({
  prizeDisplay,
  orbState,
  drawId,
  countdownLabel,
  countdownUrgent,
  oddsDisplay,
  onEnter,
}: PlayHeroProps) {
  return (
    <section className="relative mb-12 space-y-5 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/2 -z-10 -translate-x-1/2"
      >
        <div className="h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />
      </div>

      <div className="animate-fade-in-up">
        <p className="mb-2 flex items-center justify-center gap-2.5 text-sm uppercase tracking-widest text-amber-200/70">
          <RoundOrb state={orbState} size={14} />
          Current prize pool
          {drawId != null ? <span className="text-gray-500">· draw #{drawId}</span> : null}
        </p>
        {prizeDisplay ? (
          <h1
            className={`font-black text-6xl md:text-8xl leading-none tracking-tight tabular-nums ${ACCENTS.play.gradientText}`}
          >
            {prizeDisplay}
          </h1>
        ) : (
          <div
            aria-hidden
            className="mx-auto h-20 w-3/4 max-w-xl animate-pulse rounded-2xl bg-white/[0.06] md:h-28"
          />
        )}
      </div>

      <p className="mx-auto max-w-md text-lg md:text-xl text-gray-300">
        Keep your capital. Its earnings play.
      </p>
      <p className="mx-auto max-w-sm text-sm text-gray-500">
        $1 per ticket on Base. Non-custodial, provably fair, paid instantly on win.
      </p>

      <div className="flex justify-center pt-3 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
        {/* Finite laps: money CTA earns a beam, not a forever glow (DESIGN.md). */}
        <BeamFrame laps={2} duration={4} className="rounded-2xl inline-block">
          <Button
            variant="warning"
            size="lg"
            className="text-lg px-8 py-5 shadow-2xl shadow-amber-500/10 group w-full sm:w-auto"
            title="Enter draw (E)"
            onClick={onEnter}
          >
            Enter draw
            {countdownLabel && (
              <span
                className={`ml-2 inline-flex items-center gap-1 text-sm opacity-80 group-hover:opacity-100 ${countdownUrgent ? "text-amber-200" : ""}`}
              >
                <Clock className="w-3.5 h-3.5" />
                {countdownLabel}
              </span>
            )}
          </Button>
        </BeamFrame>
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500 pt-1 animate-fade-in-up"
        style={{ animationDelay: "250ms" }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          Live on Base
        </span>
        {oddsDisplay && (
          <>
            <span className="text-gray-700">·</span>
            <span className="text-amber-300/80 font-semibold">{oddsDisplay} per ticket</span>
          </>
        )}
      </div>
    </section>
  );
}
