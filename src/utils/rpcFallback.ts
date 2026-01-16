/**
 * RPC Fallback Utility
 * 
 * Shared logic for handling RPC endpoint selection with fallbacks
 * Used by both bridge protocols and wallet services
 */

export function getSolanaRpcUrls(): string[] {
  const urls: string[] = [];

  // Priority 1: Alchemy with API key (most reliable)
  if (process.env.SOLANA_ALCHEMY_API_KEY) {
    urls.push(
      `https://solana-mainnet.g.alchemy.com/v2/${process.env.SOLANA_ALCHEMY_API_KEY}`
    );
  }

  // Priority 2: Custom RPC
  const primary =
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    'https://rpc.ankr.com/solana';
  urls.push(primary);

  // Priority 3: Fallback endpoints
  const defaultFallbacks = [
    'https://rpc.ankr.com/solana',
    'https://solana-api.projectserum.com',
  ];
  
  const configuredFallbacks = (process.env.NEXT_PUBLIC_SOLANA_RPC_FALLBACKS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return [...urls, ...configuredFallbacks, ...defaultFallbacks].filter((u, i, a) => a.indexOf(u) === i);
}

export function getBaseRpcUrls(): string[] {
  const urls: string[] = [];

  // Priority 1: Configured Base RPC
  const primary =
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    'https://base-mainnet.g.alchemy.com/v2/zXTB8midlluEtdL8Gay5bvz5RI-FfsDH';
  urls.push(primary);

  // Priority 2: Fallback Base RPCs
  const fallbacks = (process.env.NEXT_PUBLIC_BASE_RPC_FALLBACKS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return [...urls, ...fallbacks].filter((u, i, a) => a.indexOf(u) === i);
}

/**
 * Execute a function with RPC fallback retry logic
 * Tries each RPC endpoint in sequence until one succeeds
 */
export async function executeWithRpcFallback<T>(
  fn: (rpcUrl: string) => Promise<T>,
  rpcUrls: string[],
  timeout?: number
): Promise<T> {
  if (!rpcUrls.length) {
    throw new Error('No RPC URLs available');
  }

  let lastError: Error | null = null;

  for (const url of rpcUrls) {
    try {
      const result = await Promise.race([
        fn(url),
        timeout
          ? new Promise<T>((_, reject) =>
              setTimeout(
                () => reject(new Error('RPC timeout')),
                timeout
              )
            )
          : Promise.resolve(undefined as unknown as T),
      ]);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next RPC
      continue;
    }
  }

  throw lastError || new Error('All RPC endpoints failed');
}
