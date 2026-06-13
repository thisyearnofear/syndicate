'use client';

import { RouteErrorFallback } from '@/shared/components/RouteErrorFallback';

export default function BridgeErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      routeLabel="Bridge"
      title="Couldn't start the bridge"
      description="We hit a snag talking to the bridge protocols. Your funds are safe — try a different route or retry."
      error={error}
      reset={reset}
    />
  );
}
