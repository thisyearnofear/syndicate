/**
 * CCTP Attestation Proxy
 *
 * Proxies Circle's Iris attestation API to avoid CORS issues in the browser.
 * The client polls this endpoint until status === 'complete', then submits
 * receiveMessage() directly from the user's EVM wallet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAttestation } from '@/services/bridges/cctpAttestationRelay';

export async function GET(
  _req: NextRequest,
  { params }: { params: { messageHash: string } }
): Promise<NextResponse> {
  const { messageHash } = params;

  if (!messageHash || !/^0x[0-9a-fA-F]{64}$/.test(messageHash)) {
    return NextResponse.json({ error: 'Invalid messageHash' }, { status: 400 });
  }

  const result = await fetchAttestation(messageHash);
  return NextResponse.json(result);
}
