'use client';

/**
 * SEAL BURST — the arena's celebration beat (docs/DESIGN.md reveal grammar).
 *
 * A wax seal cracks and throws brass flecks. It is the period-correct
 * equivalent of confetti: a 17th-century tontine settled under seal, so the
 * seal is what breaks when the pot is called.
 *
 * Honesty contract: fires only on a *verified* outcome. Callers must not mount
 * it on optimistic state — in Season it appears after the settlement journal
 * has confirmed both on-chain receipts, never while a purchase is pending.
 *
 * Fires once (`both` fill) and is fully disabled under prefers-reduced-motion,
 * where the seal still renders as a static mark so the moment is not lost.
 */

import { useMemo } from 'react';
import type { CSSProperties } from 'react';

interface SealBurstProps {
  /** Diameter of the seal in px. */
  size?: number;
  /** Number of flecks thrown. */
  flecks?: number;
  /** Short mark struck into the seal — initials, a numeral. */
  mark?: string;
  className?: string;
}

interface Fleck {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

/**
 * Deterministic scatter: a golden-angle spiral rather than Math.random, so the
 * burst is identical on server and client (no hydration mismatch) and reads
 * evenly distributed rather than clumped.
 */
function buildFlecks(count: number, radius: number): Fleck[] {
  const GOLDEN = 2.399963; // radians
  return Array.from({ length: count }, (_, i) => {
    const angle = i * GOLDEN;
    const spread = radius * (0.75 + ((i * 37) % 50) / 100);
    return {
      x: Math.round(Math.cos(angle) * spread),
      y: Math.round(Math.sin(angle) * spread),
      size: 2 + ((i * 13) % 3),
      delay: (i % 5) * 40,
      duration: 900 + ((i * 71) % 500),
    };
  });
}

export function SealBurst({ size = 56, flecks = 18, mark = '', className = '' }: SealBurstProps) {
  const scatter = useMemo(() => buildFlecks(flecks, size * 1.9), [flecks, size]);

  return (
    <span
      aria-hidden
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Flecks first so the seal sits above them. */}
      {scatter.map((f, i) => (
        <span
          key={i}
          className="seal-fleck absolute rounded-full"
          style={
            {
              width: f.size,
              height: f.size,
              background: 'var(--gold-300)',
              '--fleck-x': `${f.x}px`,
              '--fleck-y': `${f.y}px`,
              '--fleck-delay': `${f.delay}ms`,
              '--fleck-duration': `${f.duration}ms`,
            } as CSSProperties
          }
        />
      ))}

      {/* The seal: oxblood wax with a brass rim and a struck mark. */}
      <span
        className="seal-crack relative flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background:
            'radial-gradient(circle at 34% 30%, #a8352a 0%, #7a2018 52%, #4a1009 100%)',
          border: '1.5px solid rgba(201, 162, 39, 0.55)',
          boxShadow:
            'inset 0 2px 6px rgba(255, 220, 190, 0.22), inset 0 -3px 8px rgba(0,0,0,0.5), 0 8px 22px -8px rgba(122, 32, 24, 0.8)',
        }}
      >
        {/* Scalloped wax edge, drawn as a dashed ring. */}
        <span
          className="absolute rounded-full"
          style={{
            inset: 3,
            border: '1px dashed rgba(247, 234, 208, 0.28)',
          }}
        />
        {mark && (
          <span
            className="font-display font-bold leading-none"
            style={{ fontSize: size * 0.36, color: 'var(--gold-100)' }}
          >
            {mark}
          </span>
        )}
      </span>
    </span>
  );
}
