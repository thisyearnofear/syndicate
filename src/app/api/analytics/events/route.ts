/**
 * POST /api/analytics/events
 *
 * Receives batched funnel analytics from the client-side analytics subscriber.
 * Logs them via the application logger for now; can be routed to a data
 * warehouse, Posthog, or Mixpanel in the future.
 *
 * This endpoint is fire-and-forget from the client's perspective.
 * It never returns errors that would affect the user experience.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.sessions)) {
      return NextResponse.json({ ok: true }); // Silently accept malformed payloads
    }

    const { sessions, flushedAt } = body;

    // Aggregate metrics for the log entry
    const completed = sessions.filter((s: { outcome: string }) => s.outcome === 'completed').length;
    const failed = sessions.filter((s: { outcome: string }) => s.outcome === 'failed').length;
    const operations = [...new Set(sessions.map((s: { operation: string }) => s.operation))];
    const avgDurationMs = sessions
      .filter((s: { durationMs: number | null }) => s.durationMs !== null)
      .reduce((sum: number, s: { durationMs: number }) => sum + s.durationMs, 0) / (sessions.length || 1);

    logger.info('[Analytics] Funnel batch received', {
      count: sessions.length,
      completed,
      failed,
      operations,
      avgDurationMs: Math.round(avgDurationMs),
      flushedAt,
    });

    // Log individual failures for debugging
    const failures = sessions.filter((s: { outcome: string }) => s.outcome === 'failed');
    for (const f of failures) {
      logger.warn('[Analytics] Funnel drop-off', {
        operation: f.operation,
        chain: f.chain,
        provider: f.provider,
        errorCode: f.error?.code,
        errorPhase: f.error?.phase,
        userCancelled: f.error?.userCancelled,
        durationMs: f.durationMs,
        steps: f.steps?.length,
      });
    }

    return NextResponse.json({ ok: true, received: sessions.length });
  } catch {
    // Analytics should never return 5xx to the client
    return NextResponse.json({ ok: true });
  }
}
