'use client';

import { RouteErrorFallback } from '@/shared/components/RouteErrorFallback';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      routeLabel="Settings"
      title="Couldn't load settings"
      description="We hit a snag reading your preferences. Your saved settings are intact — try again."
      error={error}
      reset={reset}
    />
  );
}
