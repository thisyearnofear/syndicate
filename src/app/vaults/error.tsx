'use client';

import { RouteErrorFallback } from '@/shared/components/RouteErrorFallback';

export default function VaultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      routeLabel="Vaults"
      title="Couldn't load your vaults"
      description="We hit a snag reading your vault balances. Try again, or pick a different vault."
      error={error}
      reset={reset}
    />
  );
}
