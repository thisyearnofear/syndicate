import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventName = typeof body?.eventName === 'string' ? body.eventName : null;
    const properties =
      body?.properties && typeof body.properties === 'object' ? body.properties : {};

    if (!eventName) {
      return NextResponse.json(
        { error: 'eventName is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const payload = {
      eventName,
      properties,
      path: body?.path ?? null,
      timestamp: body?.timestamp ?? Date.now(),
    };

    logger.info('[AnalyticsEvent]', payload);

    const webhookUrl = process.env.ANALYTICS_WEBHOOK_URL;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((error) => {
        logger.warn('[AnalyticsEvent] webhook forward failed', { error: String(error) });
      });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    logger.error('[AnalyticsEvent] POST error', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
