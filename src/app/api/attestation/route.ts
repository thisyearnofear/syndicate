export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const messageHash = url.searchParams.get('messageHash');
    if (!messageHash) {
      return Response.json({ error: 'messageHash is required' }, { status: 400 });
    }

    const target = `https://iris-api.circle.com/v1/attestations/${messageHash}`;
    const resp = await fetch(target);
    const text = await resp.text();
    return new Response(text, { status: resp.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return Response.json({ error: 'Attestation proxy failed' }, { status: 502 });
  }
}
