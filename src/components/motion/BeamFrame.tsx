"use client";

/**
 * BEAM FRAME — light tracing the contour of "money is moving here".
 *
 * A conic-gradient border beam that chases itself around the wrapped element
 * (pure CSS, GPU-animated gradient angle). Applied to surfaces where money
 * genuinely moves: the Enter-draw CTA, the last-winner strip, the purchase
 * receipt. Respects prefers-reduced-motion via globals.css (.beam-frame).
 */

import { useMemo, type CSSProperties, type ReactNode } from "react";

interface BeamFrameProps {
  children: ReactNode;
  /** Beam color, defaults to amber */
  color?: string;
  /** Period of one lap in seconds, defaults to 5 */
  duration?: number;
  /** Number of laps; `Infinity` keeps the beam running */
  laps?: number;
  className?: string;
}

export function BeamFrame({
  children,
  color = '#fbbf24',
  duration = 5,
  laps = 1,
  className = "",
}: BeamFrameProps) {
  const style = useMemo<CSSProperties>(
    () =>
      ({
        '--beam-color': color,
        '--beam-duration': `${duration}s`,
        '--beam-count': laps === Infinity ? 'infinite' : `${laps}`,
      }) as CSSProperties,
    [color, duration, laps],
  );

  return (
    <span className={`beam-frame rounded-2xl ${className}`} style={style}>
      {children}
    </span>
  );
}
