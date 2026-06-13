'use client';

import { RouteErrorFallback } from '@/shared/components/RouteErrorFallback';

export default function PortfolioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      routeLabel="Portfolio"
      title="Couldn't load your portfolio"
      description="We hit a snag fetching your vault and syndicate positions. Your funds are safe — try again in a moment."
      error={error}
      reset={reset}
    />
  );
}
