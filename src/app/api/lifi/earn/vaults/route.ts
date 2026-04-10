import { NextRequest, NextResponse } from 'next/server';
import { LIFI_EARN_API_BASE_URL } from '@/config/lifi';

export async function GET(request: NextRequest) {
  const incoming = new URL(request.url);
  const target = new URL(`${LIFI_EARN_API_BASE_URL}/v1/earn/vaults`);

  incoming.searchParams.forEach((value, key) => {
    if (value) {
      target.searchParams.set(key, value);
    }
  });

  try {
    const apiKey = process.env.LIFI_API_KEY || process.env.NEXT_PUBLIC_LIFI_API_KEY || '';
    const response = await fetch(target.toString(), {
      headers: apiKey ? { 'x-lifi-api-key': apiKey } : undefined,
      next: { revalidate: 60 },
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LI.FI Earn vaults request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
