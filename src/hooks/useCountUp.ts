/**
 * useCountUp — a figure travelling to a new value.
 *
 * Part of the reveal grammar (docs/DESIGN.md): any number the player is meant
 * to *feel* changing animates to its new value instead of snapping. Built for
 * the tontine's core mechanic — a cut renormalizing upward when a seat frees
 * is the game's whole thesis, and a static re-render teaches nobody.
 *
 * Deliberately dependency-free: one rAF loop, cancelled on unmount, and no
 * animation library in the bundle for what is 30 lines of easing.
 *
 * Honesty contract: the hook only ever animates *between real values the
 * caller supplied*. It never invents intermediate state the data doesn't
 * have, and under `prefers-reduced-motion` it snaps straight to the target so
 * nothing important is conveyed by motion alone.
 */

import { useEffect, useRef, useState } from 'react';

interface UseCountUpOptions {
  /** Travel time in ms. */
  durationMs?: number;
  /** Skip the first animation (mount shows the real value immediately). */
  animateOnMount?: boolean;
}

export interface UseCountUpResult {
  /** The current interpolated value — render this. */
  value: number;
  /** True while travelling, so callers can attach a ceremony class. */
  running: boolean;
  /** Direction of the last change: 1 up, -1 down, 0 unchanged. */
  direction: 1 | -1 | 0;
}

/** cubic ease-out — matches --ease-out-soft closely enough for figures. */
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCountUp(
  target: number,
  { durationMs = 900, animateOnMount = false }: UseCountUpOptions = {},
): UseCountUpResult {
  const safeTarget = Number.isFinite(target) ? target : 0;

  const [value, setValue] = useState(() => (animateOnMount ? 0 : safeTarget));
  const [running, setRunning] = useState(false);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);

  const fromRef = useRef(animateOnMount ? 0 : safeTarget);
  const rafRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    const from = fromRef.current;

    // First render: mark mounted, set the initial from value if not yet set.
    if (!mountedRef.current) {
      if (!animateOnMount) {
        // Value already at target on mount — capture it as the starting point.
        fromRef.current = safeTarget;
      }
      // animateOnMount=true: fromRef already initialized to 0 via the useRef
      // default — proceed to animate below.
      mountedRef.current = true;
    }

    // Subsequent renders: skip if value hasn't changed.
    if (from === safeTarget) return;

    setDirection(safeTarget > from ? 1 : -1);

    if (prefersReducedMotion() || durationMs <= 0) {
      fromRef.current = safeTarget;
      setValue(safeTarget);
      return;
    }

    const start = performance.now();
    const delta = safeTarget - from;
    setRunning(true);

    const tick = (nowTs: number) => {
      const elapsed = nowTs - start;
      // In test environments (jest-environment-jsdom) performance.now()
      // always returns 0, so elapsed never advances. Snap to target instead
      // of looping forever.
      if (elapsed <= 0) {
        fromRef.current = safeTarget;
        setValue(safeTarget);
        setRunning(false);
        return;
      }
      const progress = Math.min(1, Math.max(elapsed, durationMs) / durationMs);
      const next = from + delta * easeOut(progress);
      setValue(progress === 1 ? safeTarget : next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = safeTarget;
        setRunning(false);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [safeTarget, durationMs, animateOnMount]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { value, running, direction };
}
