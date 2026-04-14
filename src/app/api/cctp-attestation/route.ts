/**
 * CCTP Attestation Proxy
 *
 * Proxies Circle's Iris attestation API to avoid CORS issues in the browser.
 * The client polls this endpoint until status === 'complete', then submits
 * receiveMessage() directly from the user's EVM wallet.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { fetchAttestation } from '@/services/bridges/cctpAttestationRelay';

// This route proxies Circle's attestation API — it must never be statically
// generated because it depends on a runtime messageHash param and external fetch.
// Without this, Next.js tries to pre-render during build and crashes with
// "TypeError: n.cache is not a function" (fetch.cache unavailable in SSG).

export async function GET(
  req: NextRequest
): Promise<NextResponse> {
  const messageHash = req.nextUrl.searchParams.get('messageHash');

  if (!messageHash || !/^0x[0-9a-fA-F]{64}$/.test(messageHash)) {
    return NextResponse.json({ error: 'Invalid messageHash' }, { status: 400 });
  }

  const result = await fetchAttestation(messageHash);
  return NextResponse.json(result);
}
