/**
 * LIGHTWEIGHT ERROR CAPTURE
 *
 * Posts errors to Sentry's HTTP Envelope API without requiring the SDK.
 * Falls back to console.error if SENTRY_DSN is not configured.
 *
 * Core Principles: MODULAR, DRY, CLEAN — single place for all error alerting.
 */

interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'info';
}

function parseDsn(dsn: string): { endpoint: string; publicKey: string } | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace('/', '');
    const endpoint = `${url.protocol}//${url.host}/api/${projectId}/envelope/`;
    return { endpoint, publicKey };
  } catch {
    return null;
  }
}

export async function captureError(
  error: Error | string,
  context: ErrorContext = {}
): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  // Always log locally
  console.error(`[captureError] ${message}`, context.extra ?? '');

  if (!dsn) return; // Sentry not configured — local log only

  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.warn('[captureError] Invalid SENTRY_DSN format');
    return;
  }

  const eventId = crypto.randomUUID().replace(/-/g, '');
  const now = Math.floor(Date.now() / 1000);

  const envelope = [
    // Envelope header
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn }),
    // Item header
    JSON.stringify({ type: 'event', content_type: 'application/json' }),
    // Event payload
    JSON.stringify({
      event_id: eventId,
      timestamp: now,
      platform: 'node',
      level: context.level ?? 'error',
      logger: 'syndicate.job-processor',
      message,
      exception: stack
        ? {
            values: [
              {
                type: error instanceof Error ? error.constructor.name : 'Error',
                value: message,
                stacktrace: {
                  frames: stack
                    .split('\n')
                    .slice(1)
                    .map((line) => ({ filename: line.trim() })),
                },
              },
            ],
          }
        : undefined,
      tags: context.tags,
      extra: context.extra,
    }),
  ].join('\n');

  try {
    await fetch(parsed.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}`,
      },
      body: envelope,
    });
  } catch (fetchErr) {
    // Never let monitoring failures crash the app
    console.warn('[captureError] Failed to send to Sentry:', fetchErr);
  }
}
