'use client';

interface AnalyticsPayload {
  eventName: string;
  properties?: Record<string, unknown>;
}

export async function trackEvent(payload: AnalyticsPayload): Promise<void> {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    ...payload,
    path: window.location.pathname,
    timestamp: Date.now(),
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/track', blob);
      return;
    }
  } catch {
    // Fall through to fetch.
  }

  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics should never block UX.
  }
}
