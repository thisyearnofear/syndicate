// STUB: Using stubs while Solana deps are disabled for hackathon
// TO RE-ENABLE: Replace with '@solana/web3.js' and '@solana/spl-token'
import { Connection, PublicKey, getAssociatedTokenAddress } from '@/stubs/solana';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function selectRpcUrls(): string[] {
  const urls: string[] = [];

  // Add Alchemy endpoint if key exists (highest priority)
  if (process.env.SOLANA_ALCHEMY_API_KEY) {
    urls.push(
      `https://solana-mainnet.g.alchemy.com/v2/${process.env.SOLANA_ALCHEMY_API_KEY}`
    );
  }

  // Add other configured endpoints
  const primary =
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    'https://api.mainnet-beta.solana.com';
  urls.push(primary);

  const fallbacks = (process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Remove duplicates
  return [...urls, ...fallbacks].filter((u, i, a) => a.indexOf(u) === i);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return Response.json(
        { error: 'wallet parameter required' },
        { status: 400 }
      );
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch {
      return Response.json(
        { error: 'invalid wallet address' },
        { status: 400 }
      );
    }

    const walletPubkey = new PublicKey(walletAddress);
    const usdcMint = new PublicKey(USDC_MINT);
    const ata = await getAssociatedTokenAddress(usdcMint, walletPubkey);

    const urls = selectRpcUrls();
    let lastError: string | null = null;

    for (const url of urls) {
      try {
        const connection = new Connection(url, 'confirmed');
        const bal = await connection.getTokenAccountBalance(ata);
        const balance = bal?.value?.uiAmount?.toString() || '0';

        return Response.json(
          { balance, success: true },
          { status: 200 }
        );
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e);
        continue;
      }
    }

    // All endpoints failed, return 0 balance with error
    return Response.json(
      { balance: '0', success: false, error: lastError },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return Response.json(
      { error: msg },
      { status: 500 }
    );
  }
}
