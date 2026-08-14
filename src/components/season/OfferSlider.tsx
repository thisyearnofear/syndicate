'use client';

/**
 * OFFER SLIDER — the game's climactic input, made legible.
 *
 * Calling the pot and bidding used to be a bare text field with the range
 * hidden in a placeholder ("Your offer to the crew % (1–50)"). A player had to
 * know the rules, type an integer, and then do arithmetic in their head to work
 * out what it cost them. That is a spreadsheet, not a game — and it films as
 * nothing at all.
 *
 * A slider shows the whole legal range, makes the tradeoff continuous, and
 * moves on camera. Beneath it sits the payout preview docs/SEASON.md §5.2
 * always specified: *you take this, the crew gets that.*
 *
 * Honesty: absolute figures are only shown when a real chest snapshot exists.
 * Before a round opens there is no snapshot, so the preview stays proportional
 * and says so, rather than inventing a number.
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
  /**
   * Chest snapshot in USDC. `null` before a round exists — the preview then
   * shows shares only and explains why.
   */
  chestUsdc: number | null;
  /** Live Megapot ticket price, for the ticket-count preview. */
  ticketPrice: number;
  /** False when the ticket price is still the fallback — hedges the preview. */
  ticketPriceResolved?: boolean;
  /** Floor imposed by an existing leading bid (raise-only auction). */
  minRaisePct?: number;
  disabled?: boolean;
  label?: string;
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
  disabled = false,
  label = 'Your offer to the crew',
}: OfferSliderProps) {
  const id = useId();
  const floor = minRaisePct != null ? Math.max(min, minRaisePct) : min;
  const clamped = Math.min(max, Math.max(floor, valuePct));
  const fillPct = ((clamped - min) / (max - min)) * 100;

  const youKeepPct = 100 - clamped;
  const price = ticketPrice > 0 ? ticketPrice : 1;

  const yourUsdc = chestUsdc != null ? chestUsdc * (youKeepPct / 100) : null;
  const crewUsdc = chestUsdc != null ? chestUsdc * (clamped / 100) : null;
  const yourTickets = yourUsdc != null ? Math.max(1, Math.floor(yourUsdc / price)) : null;
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
        <span>{floor}% — keep almost all of it, and probably lose</span>
        <span>{max}% — buy the exit</span>
      </div>

      {/* The payout preview: the tradeoff, spelled out. */}
      <div
        id={`${id}-preview`}
        className="vellum grid grid-cols-2 gap-px overflow-hidden rounded-xl"
        aria-live="polite"
      >
        <div className="bg-[#0a0705]/40 p-3">
          <p className="arena-label text-[9px]">You would take</p>
          {yourUsdc != null ? (
            <>
              <CountUp
                value={yourUsdc}
                decimals={2}
                prefix="$"
                grouped
                durationMs={280}
                className="font-display text-xl font-bold text-[#f7ead0]"
              />
              <p className="mt-0.5 text-[11px] text-[#d8c9ae]/60">
                ≈ {yourTickets} ticket{yourTickets !== 1 ? 's' : ''}
              </p>
            </>
          ) : (
            <>
              <span className="font-display text-xl font-bold text-[#f7ead0]">
                {youKeepPct % 1 === 0 ? youKeepPct.toFixed(0) : youKeepPct.toFixed(1)}%
              </span>
              <p className="mt-0.5 text-[11px] text-[#d8c9ae]/60">of the chest</p>
            </>
          )}
        </div>
        <div className="bg-[#0a0705]/40 p-3">
          <p className="arena-label text-[9px]">The crew receives</p>
          {crewUsdc != null ? (
            <>
              <CountUp
                value={crewUsdc}
                decimals={2}
                prefix="$"
                grouped
                durationMs={280}
                className="font-display text-xl font-bold text-[#e3c887]"
              />
              <p className="mt-0.5 text-[11px] text-[#d8c9ae]/60">
                ≈ {crewTickets} bonus ticket{crewTickets !== 1 ? 's' : ''}
              </p>
            </>
          ) : (
            <>
              <span className="font-display text-xl font-bold text-[#e3c887]">
                {clamped % 1 === 0 ? clamped.toFixed(0) : clamped.toFixed(1)}%
              </span>
              <p className="mt-0.5 text-[11px] text-[#d8c9ae]/60">as bonus tickets</p>
            </>
          )}
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
