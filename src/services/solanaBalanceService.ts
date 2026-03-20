import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { getSolanaRpcUrls } from '@/utils/rpcFallback';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const cache: Record<string, { ts: number; balance: string }> = {};

function selectRpcUrls(): string[] {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return getSolanaRpcUrls()
    .map(u => (u && u.startsWith('/') && origin ? origin + u : u));
}

async function fetchBalanceFromRpc(url: string, ata: PublicKey): Promise<string> {
  if (!url) throw new Error('invalid_rpc');
  const connection = new Connection(url, 'confirmed');
  const bal = await connection.getTokenAccountBalance(ata);
  return bal?.value?.uiAmountString || bal?.value?.uiAmount?.toString?.() || '0';
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
        const balance = await fetchBalanceFromRpc(url, ata);
        lastBalance = balance;
        cache[walletAddress] = { ts: now, balance: lastBalance };
        return lastBalance;
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message || String(e);
        if (msg.includes('403')) continue;
        continue;
      }
    }

    cache[walletAddress] = { ts: now, balance: lastBalance };
    return lastBalance;
  } catch {
    return '0';
  }
}
