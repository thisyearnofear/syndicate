'use client';

/**
 * OFFER SLIDER — the game's climactic input, made legible.
 *
 * The slider does more than expose 1–50%: it makes the strategic tradeoff
 * visible. A player can now compare their current tontine cut with the share
 * they would take by buying an exit, and see the gift that survives for the
 * crew. This turns a mysterious number into a decision.
 *
 * All absolute values are derived from a real chest snapshot and the live
 * ticket-price read. Before a round exists there is no snapshot, so the panel
 * stays proportional and says so rather than inventing a dollar figure.
 */

import { useId } from 'react';
import type { CSSProperties } from 'react';
import { CountUp } from '@/components/motion/CountUp';

interface OfferSliderProps {
  /** Current offer to the crew, in percent. */
  valuePct: number;
  onChange: (pct: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Chest snapshot in USDC. `null` before a round exists. */
  chestUsdc: number | null;
  /** Live Megapot ticket price, for payout previews. */
  ticketPrice: number;
  /** False when the ticket price is still the fallback. */
  ticketPriceResolved?: boolean;
  /** Floor imposed by an existing leading bid (raise-only auction). */
  minRaisePct?: number;
  /** The viewer's current active-seat cut, in basis points. */
  currentCutBps?: number | null;
  disabled?: boolean;
  label?: string;
}

function pctLabel(value: number): string {
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
}

export function OfferSlider({
  valuePct,
  onChange,
  min = 1,
  max = 50,
  step = 0.5,
  chestUsdc,
  ticketPrice,
  ticketPriceResolved = false,
  minRaisePct,
  currentCutBps,
  disabled = false,
  label = 'Your offer to the crew',
}: OfferSliderProps) {
  const id = useId();
  const floor = minRaisePct != null ? Math.max(min, minRaisePct) : min;
  const clamped = Math.min(max, Math.max(floor, valuePct));
  const fillPct = ((clamped - min) / (max - min)) * 100;

  const currentCutPct = currentCutBps != null ? currentCutBps / 100 : null;
  const exitSharePct = 100 - clamped;
  const price = ticketPrice > 0 ? ticketPrice : 1;

  const stayUsdc =
    chestUsdc != null && currentCutPct != null ? chestUsdc * (currentCutPct / 100) : null;
  const exitUsdc = chestUsdc != null ? chestUsdc * (exitSharePct / 100) : null;
  const crewUsdc = chestUsdc != null ? chestUsdc * (clamped / 100) : null;
  const stayTickets = stayUsdc != null ? Math.max(1, Math.floor(stayUsdc / price)) : null;
  const exitTickets = exitUsdc != null ? Math.max(1, Math.floor(exitUsdc / price)) : null;
  const crewTickets = crewUsdc != null ? Math.max(1, Math.floor(crewUsdc / price)) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="arena-label text-[11px]">
          {label}
        </label>
        <span className="inline-flex items-baseline gap-1">
          <CountUp
            value={clamped}
            decimals={clamped % 1 === 0 ? 0 : 1}
            durationMs={0}
            className="font-display text-4xl font-bold leading-none text-[#f7ead0]"
          />
          <span className="font-display text-lg text-[#e3c887]/70">%</span>
        </span>
      </div>

      <input
        id={id}
        type="range"
        className="arena-slider"
        min={floor}
        max={max}
        step={step}
        value={clamped}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--slider-fill': `${fillPct}%` } as CSSProperties}
        aria-describedby={`${id}-preview`}
      />

      <div className="flex justify-between text-[10px] text-[#d8c9ae]/45">
        <span>{floor}% — smaller gift</span>
        <span>{max}% — stronger exit</span>
      </div>

      {/* The decision comparison: stay versus buy the exit. */}
      <div id={`${id}-preview`} className="space-y-2" aria-live="polite">
        <p className="arena-label text-[9px]">The decision</p>
        <div className="vellum grid grid-cols-2 gap-px overflow-hidden rounded-xl">
          <div className="bg-[#0a0705]/40 p-3">
            <p className="arena-label text-[9px]">Stay in the tontine</p>
            {currentCutPct != null ? (
              <>
                <span className="font-display text-xl font-bold text-[#d8c9ae]">
                  {pctLabel(currentCutPct)}%
                </span>
                <p className="mt-0.5 text-[11px] text-[#d8c9ae]/60">
                  current cut
                  {stayUsdc != null && (
                    <> · ≈ ${stayUsdc.toFixed(2)} / {stayTickets} ticket{stayTickets !== 1 ? 's' : ''}</>
                  )}
                </p>
              </>
            ) : (
              <>
                <span className="font-display text-xl font-bold text-[#d8c9ae]">Your cut</span>
                <p className="mt-0.5 text-[11px] text-[#d8c9ae]/60">available from your seat</p>
              </>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-[#d8c9ae]/45">
              Keep your seat and its future share of the crew claim.
            </p>
          </div>
          <div className="bg-[#c9a227]/[0.07] p-3">
            <p className="arena-label text-[9px]">Buy your exit</p>
            {exitUsdc != null ? (
              <>
                <CountUp
                  value={exitUsdc}
                  decimals={2}
                  prefix="$"
                  grouped
                  durationMs={280}
                  className="font-display text-xl font-bold text-[#f7ead0]"
                />
                <p className="mt-0.5 text-[11px] text-[#d8c9ae]/70">
                  ≈ {exitTickets} ticket{exitTickets !== 1 ? 's' : ''} · keep {pctLabel(exitSharePct)}%
                </p>
              </>
            ) : (
              <>
                <span className="font-display text-xl font-bold text-[#f7ead0]">
                  {pctLabel(exitSharePct)}%
                </span>
                <p className="mt-0.5 text-[11px] text-[#d8c9ae]/70">of a future chest</p>
              </>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-[#d8c9ae]/55">
              Leave permanently if your offer leads at the bell.
            </p>
          </div>
        </div>

        <div className="vellum flex items-center justify-between gap-3 rounded-xl bg-[#c9a227]/[0.05] px-3 py-2.5">
          <div>
            <p className="arena-label text-[9px]">Gift to the survivors</p>
            <p className="text-[11px] text-[#d8c9ae]/65">
              {crewUsdc != null
                ? `≈ $${crewUsdc.toFixed(2)} · ${crewTickets} bonus ticket${crewTickets !== 1 ? 's' : ''}`
                : `${pctLabel(clamped)}% of the future chest as bonus tickets`}
            </p>
          </div>
          <span className="font-display text-2xl font-bold text-[#e3c887]">{pctLabel(clamped)}%</span>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-[#d8c9ae]/45">
        {chestUsdc == null ? (
          <>
            The chest is snapshotted on-chain when the round opens, so exact figures appear then —
            nothing is estimated here.
          </>
        ) : (
          <>
            Ticket price {ticketPriceResolved ? '' : 'assumed '}${price.toFixed(2)}
            {ticketPriceResolved ? ' (live)' : ' (fallback — live read unavailable)'}. Both payouts
            are real Megapot purchases at settlement.
          </>
        )}
      </p>
    </div>
  );
}
