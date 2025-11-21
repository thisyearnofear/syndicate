import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

let cache: Record<string, { ts: number; balance: string }> = {};

function selectRpcUrls(): string[] {
  const primary = process.env.NEXT_PUBLIC_SOLANA_RPC || '/api/solana-rpc';
  const fallbacks = (process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const urls = [primary, ...fallbacks]
    .map(u => (u && u.startsWith('/') && origin ? origin + u : u));
  const seen = new Set<string>();
  return urls.filter(u => {
    const key = (u || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getSolanaUSDCBalance(walletAddress: string): Promise<string> {
  try {
    const now = Date.now();
    const cached = cache[walletAddress];
    if (cached && (now - cached.ts) < 10000) {
      return cached.balance;
    }

    const walletPubkey = new PublicKey(walletAddress);
    const usdcMint = new PublicKey(USDC_MINT);
    const ata = await getAssociatedTokenAddress(usdcMint, walletPubkey);

    const urls = selectRpcUrls();
    let lastBalance = '0';

    const post = async (u: string, body: any) => {
      const resp = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) throw new Error('rpc_failed');
      const json = await resp.json();
      if (json.error) throw new Error(json.error.message || 'rpc_error');
      return json.result;
    };
    for (const url of urls) {
      try {
        const result = await post(url, { jsonrpc: '2.0', id: 1, method: 'getTokenAccountBalance', params: [ata.toString(), { commitment: 'confirmed' }] });
        const ui = result?.value?.uiAmountString || result?.value?.uiAmount?.toString?.() || '0';
        lastBalance = ui;
        cache[walletAddress] = { ts: now, balance: lastBalance };
        return lastBalance;
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg.includes('403')) continue;
        continue;
      }
    }

    cache[walletAddress] = { ts: now, balance: lastBalance };
    return lastBalance;
  } catch (_) {
    return '0';
  }
}
