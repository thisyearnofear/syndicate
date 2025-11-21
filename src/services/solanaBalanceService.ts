import { Connection, PublicKey } from '@solana/web3.js';
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

    for (const url of urls) {
      try {
        const connection = new Connection(url, 'confirmed');
        const bal = await connection.getTokenAccountBalance(ata);
        lastBalance = bal?.value?.uiAmount?.toString() || '0';
        cache[walletAddress] = { ts: now, balance: lastBalance };
        return lastBalance;
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg.includes('403')) {
          continue;
        }
        continue;
      }
    }

    cache[walletAddress] = { ts: now, balance: lastBalance };
    return lastBalance;
  } catch (_) {
    return '0';
  }
}
