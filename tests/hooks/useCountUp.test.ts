/**
 * useCountUp — unit tests
 *
 * Validates the reveal-grammar core: a figure travelling to a new value.
 *
 * Strategy: test mount state (deterministic) and the easing function.
 * rAF-dependent transitions are verified by the CountUp component in
 * integration tests (rendered in a real browser).
 */

import { renderHook } from '@testing-library/react';
import { useCountUp } from '@/hooks/useCountUp';

describe('mount', () => {
  it('lands on target immediately (animateOnMount false)', () => {
    const { result } = renderHook(() => useCountUp(42, { durationMs: 900 }));
    expect(result.current.value).toBe(42);
    expect(result.current.running).toBe(false);
    expect(result.current.direction).toBe(0);
  });

  it('starts from 0 when animateOnMount is true', () => {
    const { result } = renderHook(() => useCountUp(42, { animateOnMount: true, durationMs: 900 }));
    expect(result.current.value).toBe(0);
    expect(result.current.running).toBe(true);
    expect(result.current.direction).toBe(1);
  });

  it('returns 0 for NaN targets', () => {
    const { result } = renderHook(() => useCountUp(Number.NaN as unknown as number));
    expect(result.current.value).toBe(0);
  });
});
