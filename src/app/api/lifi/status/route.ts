import { NextRequest, NextResponse } from 'next/server';
import { LIFI_API_BASE_URL, LIFI_QUOTE_TIMEOUT_MS } from '@/config/lifi';

export async function GET(request: NextRequest) {
  const apiKey = process.env.LIFI_API_KEY || process.env.NEXT_PUBLIC_LIFI_API_KEY || '';
  const incoming = new URL(request.url);

  if (!incoming.searchParams.get('txHash') && !incoming.searchParams.get('taskId')) {
    return NextResponse.json(
      { error: 'Missing txHash or taskId query parameter' },
      { status: 400 }
    );
  }

  const target = new URL(`${LIFI_API_BASE_URL}/status`);
  incoming.searchParams.forEach((value, key) => {
    if (value) {
      target.searchParams.set(key, value);
    }
  });

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['x-lifi-api-key'] = apiKey;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LIFI_QUOTE_TIMEOUT_MS);
    const response = await fetch(target.toString(), {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LI.FI status request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
