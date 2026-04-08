import { NextRequest, NextResponse } from 'next/server';
import {
  LIFI_API_BASE_URL,
  LIFI_DEFAULT_ORDER,
  LIFI_DEFAULT_SLIPPAGE,
  LIFI_QUOTE_TIMEOUT_MS,
} from '@/config/lifi';

const REQUIRED_QUERY_PARAMS = [
  'fromChain',
  'toChain',
  'fromToken',
  'toToken',
  'fromAddress',
  'fromAmount',
] as const;

export async function GET(request: NextRequest) {
  const apiKey = process.env.LIFI_API_KEY || process.env.NEXT_PUBLIC_LIFI_API_KEY || '';
  const incoming = new URL(request.url);
  const target = new URL(`${LIFI_API_BASE_URL}/quote`);

  for (const param of REQUIRED_QUERY_PARAMS) {
    if (!incoming.searchParams.get(param)) {
      return NextResponse.json(
        { error: `Missing required query parameter: ${param}` },
        { status: 400 }
      );
    }
  }

  incoming.searchParams.forEach((value, key) => {
    if (value) {
      target.searchParams.set(key, value);
    }
  });

  if (!target.searchParams.get('slippage')) {
    target.searchParams.set('slippage', LIFI_DEFAULT_SLIPPAGE);
  }

  if (!target.searchParams.get('order')) {
    target.searchParams.set('order', LIFI_DEFAULT_ORDER);
  }

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
    const message = error instanceof Error ? error.message : 'LI.FI quote request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
