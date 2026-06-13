'use client';

import { RouteErrorFallback } from '@/shared/components/RouteErrorFallback';

export default function YieldStrategiesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      routeLabel="Yield Strategies"
      title="Couldn't load yield strategies"
      description="We hit a snag reading live APYs from the underlying protocols. Try again in a moment."
      error={error}
      reset={reset}
    />
  );
}
