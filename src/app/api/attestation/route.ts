/**
 * Circle Attestation Proxy API Route
 *
 * GET /api/attestation?messageHash=0x...
 * - Proxies Circle Iris attestation fetch and applies simple retry/backoff
 * - Avoids browser CORS and stabilizes client behavior across environments
 */

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const messageHash = searchParams.get('messageHash');
    if (!messageHash || !messageHash.startsWith('0x')) {
      return Response.json({ error: 'Invalid or missing messageHash' }, { status: 400 });
    }

    const url = `https://iris-api.circle.com/v1/attestations/${messageHash}`;
    const maxAttempts = 10;
    const baseDelayMs = 3000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const resp = await fetch(url, { headers: { 'accept': 'application/json' } });
      const statusOk = resp.ok;
      let json: any = null;
      try { json = await resp.json(); } catch (_) { json = null; }

      // When Circle returns 200 with status complete
      const status = json?.status;
      const attestation = json?.attestation;
      if (statusOk && status === 'complete' && typeof attestation === 'string' && attestation.startsWith('0x')) {
        return Response.json({ status, attestation }, { status: 200 });
      }

      // Pending or non-200; wait before retrying
      await new Promise(r => setTimeout(r, baseDelayMs));
    }

    return Response.json({ status: 'timeout', attestation: null }, { status: 504 });
  } catch (error) {
    return Response.json({ error: 'Attestation proxy failed' }, { status: 500 });
  }
}