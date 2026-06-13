'use client';

import { RouteErrorFallback } from '@/shared/components/RouteErrorFallback';

export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      routeLabel="Discover"
      title="Couldn't load syndicates"
      description="We hit a snag reading the syndicate directory. Try again, or browse by category."
      error={error}
      reset={reset}
    />
  );
}
