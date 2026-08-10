"use client";

/**
 * ROUND ORB — round-state visual vocabulary ("reveal grammar" brand mark).
 *
 * One orb, four states, reused at 32px (hero) and 8px (status dots):
 *   - idle      : no round data yet (deep slate, slow breath)
 *   - active    : draw accepting entries (amber, steady pulse)
 *   - charging  : final 30 minutes before close (orange, faster pulse)
 *   - resolving : past close, outcome pending (fast irregular flicker)
 *   - settled   : just resolved (emerald settle)
 *
 * Pure CSS animation (transform/opacity only) via globals.css .round-orb.
 * Respects prefers-reduced-motion through the stylesheet media query.
 */

export type RoundOrbState = 'idle' | 'active' | 'charging' | 'resolving' | 'settled';

interface RoundOrbProps {
  state: RoundOrbState;
  size?: number;
  className?: string;
}

export function RoundOrb({ state, size = 32, className = "" }: RoundOrbProps) {
  return (
    <span
      className={`round-orb ${className}`}
      data-state={state}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Draw state: ${state}`}
    >
      <span className="orb-halo" />
      <span className="orb-core" />
    </span>
  );
}

/**
 * ORB STATE DERIVATION — pure function so callers/tests can map round
 * timestamps to a state without rendering.
 */
export function deriveOrbState(
  endTimestamp: string | undefined,
  now: number = Date.now(),
): RoundOrbState {
  if (!endTimestamp) return 'idle';
  const end = new Date(endTimestamp).getTime();
  if (Number.isNaN(end)) return 'idle';
  const msLeft = end - now;
  if (msLeft < -60_000) return 'settled'; // recently ended
  if (msLeft <= 0) return 'resolving';    // close passed, next round pending
  if (msLeft < 30 * 60_000) return 'charging';
  return 'active';
}
