/**
 * EXPLORER ROUTING — chain-aware transaction links.
 *
 * Journal entries and receipts carry their own `chain` tag; this helper
 * routes each hash to the right explorer instead of assuming one chain
 * per surface. Unknown chains fall back to the caller-provided explorer
 * (or the Base explorer, the product's home chain).
 */

import { xLayerExplorerTx } from '@/config/xlayer';

export function explorerTxForChain(
  hash: string,
  chain?: string | null,
  fallback?: (hash: string) => string,
): string {
  switch (chain) {
    case 'xlayer':
      return `https://www.oklink.com/x-layer/tx/${hash}`;
    case 'xlayer_testnet':
      return xLayerExplorerTx(hash);
    case 'base':
      return `https://basescan.org/tx/${hash}`;
    case 'base_sepolia':
      return `https://sepolia.basescan.org/tx/${hash}`;
    default:
      return fallback ? fallback(hash) : `https://basescan.org/tx/${hash}`;
  }
}
