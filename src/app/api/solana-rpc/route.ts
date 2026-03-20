export async function POST(request: Request): Promise<Response> {
  const target = process.env.SOLANA_RPC_TARGET;

  // Build target list — work even without SOLANA_RPC_TARGET configured
  const backupTargets = [
    ...(target ? [target] : []),
    'https://rpc.ankr.com/solana',
    'https://api.mainnet-beta.solana.com',
  ];

  const body = await request.text();

  for (const t of backupTargets) {
    try {
      const resp = await fetch(t, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10000), // 10s timeout per target
      });
      
      if (resp.status === 403 || resp.status === 429) {
        console.warn(`[SolanaProxy] Target ${t} returned ${resp.status}, trying backup...`);
        continue;
      }

      const text = await resp.text();
      return new Response(text, { 
        status: resp.status, 
        headers: { 'content-type': 'application/json' } 
      });
    } catch (e) {
      console.warn(`[SolanaProxy] Target ${t} failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
  }

  return Response.json({ error: 'All proxy targets failed' }, { status: 502 });
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
  } catch {
    return Response.json({ error: 'Proxy health check failed' }, { status: 502 });
  }
}
