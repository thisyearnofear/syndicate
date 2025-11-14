export async function POST(request: Request): Promise<Response> {
  const target = process.env.SOLANA_RPC_TARGET;
  if (!target) {
    return Response.json({ error: 'SOLANA_RPC_TARGET not configured' }, { status: 500 });
  }
  try {
    const body = await request.text();
    const resp = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    const text = await resp.text();
    return new Response(text, { status: resp.status, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return Response.json({ error: 'Proxy request failed' }, { status: 502 });
  }
}

export async function GET(): Promise<Response> {
  const target = process.env.SOLANA_RPC_TARGET;
  if (!target) {
    return Response.json({ error: 'SOLANA_RPC_TARGET not configured' }, { status: 500 });
  }
  try {
    const payload = { jsonrpc: '2.0', id: 1, method: 'getHealth' } as const;
    const resp = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    return Response.json(json, { status: resp.status });
  } catch (e) {
    return Response.json({ error: 'Proxy health check failed' }, { status: 502 });
  }
}