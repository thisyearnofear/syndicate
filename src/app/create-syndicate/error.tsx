'use client';

import { RouteErrorFallback } from '@/shared/components/RouteErrorFallback';

export default function CreateSyndicateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      routeLabel="Create Syndicate"
      title="Couldn't load the syndicate form"
      description="We hit a snag setting up the syndicate creator. Your draft is not saved — please try again."
      error={error}
      reset={reset}
    />
  );
}
