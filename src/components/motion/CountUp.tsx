'use client';

/**
 * COUNT UP — the house style for a figure the player should feel changing
 * (docs/DESIGN.md reveal grammar).
 *
 * Always `tabular-nums` so digits don't reflow mid-travel, and when the value
 * rises it carries the `cut-rise` ceremony beat — brass flash, small lift —
 * because in a tontine an increase is the whole point.
 *
 * Reduced motion snaps to the final value with no beat (rule 5).
 */

import { useCountUp } from '@/hooks/useCountUp';

interface CountUpProps {
  value: number;
  /** Decimal places in the rendered figure. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Travel time; 0 disables animation entirely. */
  durationMs?: number;
  /** Attach the brass `cut-rise` beat when the value increases. */
  ceremony?: boolean;
  /** Thousands separators (chest values, entry counts). */
  grouped?: boolean;
  className?: string;
}

export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  durationMs = 900,
  ceremony = false,
  grouped = false,
  className = '',
}: CountUpProps) {
  const { value: current, running, direction } = useCountUp(value, { durationMs });

  const formatted = grouped
    ? current.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : current.toFixed(decimals);

  // The beat only fires on a rise: a shrinking figure is not a celebration.
  const beat = ceremony && running && direction === 1 ? 'cut-rise' : '';

  return (
    <span className={`tabular-nums ${beat} ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
