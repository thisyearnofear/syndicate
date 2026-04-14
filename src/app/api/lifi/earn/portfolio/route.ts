import { NextRequest, NextResponse } from 'next/server';
import { LIFI_EARN_API_BASE_URL } from '@/config/lifi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest
) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const target = `${LIFI_EARN_API_BASE_URL}/v1/earn/portfolio/${address}/positions`;

  try {
    const apiKey = process.env.LIFI_API_KEY || process.env.NEXT_PUBLIC_LIFI_API_KEY || '';
    const response = await fetch(target, {
      headers: apiKey ? { 'x-lifi-api-key': apiKey } : undefined,
      cache: 'no-store',
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LI.FI Earn portfolio request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
