export async function GET(request: Request): Promise<Response> {
  const apiKey = process.env.ZEROX_API_KEY || '';
  try {
    const incoming = new URL(request.url);
    const target = new URL('https://api.0x.org/swap/v1/quote');
    incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v));
    if (!target.searchParams.get('chainId')) target.searchParams.set('chainId', '8453');
    const headers: Record<string, string> = {};
    if (apiKey) headers['0x-api-key'] = apiKey;
    const resp = await fetch(target.toString(), { headers });
    const text = await resp.text();
    return new Response(text, { status: resp.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return Response.json({ error: 'Aggregator proxy request failed' }, { status: 502 });
  }
}
