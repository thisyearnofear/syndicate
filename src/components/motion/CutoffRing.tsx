'use client';

/**
 * CUTOFF RING — a deadline made spatial (docs/DESIGN.md reveal grammar).
 *
 * A depleting ring wrapped around a countdown, used where time changes what a
 * player should do: the Call-the-Pot auction cutoff. A number alone doesn't
 * create pressure; an emptying ring does, and it reads at a glance on camera.
 *
 * The ring colour escalates with urgency (brass → orange → oxblood-red) so the
 * final minutes are legible without reading the digits. Progress comes from
 * real timestamps passed by the caller — the ring never runs on its own clock,
 * so an anti-snipe extension that moves the cutoff simply moves the ring back.
 */

interface CutoffRingProps {
  /** ms remaining until cutoff (may be negative once passed). */
  msLeft: number;
  /** Full window length in ms, used to scale the ring. */
  totalMs: number;
  size?: number;
  /** Label rendered inside the ring; caller formats the time. */
  label: string;
  /** Second line inside the ring (units, "closed"). */
  sublabel?: string;
  className?: string;
}

const STROKE = 3;

/** Under 5 minutes is the anti-snipe window; under an hour is the endgame. */
function urgencyColor(msLeft: number): string {
  if (msLeft <= 0) return '#8a6d1f';
  if (msLeft < 5 * 60_000) return '#e0563f';
  if (msLeft < 60 * 60_000) return '#e8912f';
  return '#c9a227';
}

export function CutoffRing({
  msLeft,
  totalMs,
  size = 96,
  label,
  sublabel,
  className = '',
}: CutoffRingProps) {
  const radius = (size - STROKE * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, msLeft / totalMs)) : 0;
  const offset = circumference * (1 - fraction);
  const color = urgencyColor(msLeft);
  const closed = msLeft <= 0;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={closed ? 'Auction cutoff passed' : `Auction closes in ${label}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(247, 234, 208, 0.12)"
          strokeWidth={STROKE}
        />
        {/* Remaining time */}
        <circle
          className="cutoff-ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className="font-display font-bold tabular-nums leading-none"
          style={{ fontSize: size * 0.2, color: closed ? '#8a6d1f' : 'var(--gold-100)' }}
        >
          {label}
        </span>
        {sublabel && (
          <span className="arena-label mt-1 text-[9px] leading-none">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
