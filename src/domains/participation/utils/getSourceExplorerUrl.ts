import type { SourceChainType } from '@/domains/participation/types';

export function getSourceExplorerName(sourceChain?: SourceChainType): string {
  switch (sourceChain) {
    case 'solana':
      return 'Solscan';
    case 'near':
      return 'NEAR Explorer';
    case 'stacks':
      return 'Stacks Explorer';
    case 'base':
      return 'Basescan';
    case 'ethereum':
      return 'Etherscan';
    case 'starknet':
      return 'Voyager';
    default:
      return 'Explorer';
  }
}

export function getSourceExplorerUrl(
  sourceChain?: SourceChainType,
  txId?: string | null,
): string | undefined {
  if (!txId) return undefined;

  switch (sourceChain) {
    case 'solana':
      return `https://solscan.io/tx/${txId}`;
    case 'near':
      return `https://explorer.near.org/transactions/${txId}`;
    case 'stacks':
      return `https://explorer.stacks.co/txid/${txId}?chain=mainnet`;
    case 'ethereum':
      return `https://etherscan.io/tx/${txId}`;
    case 'base':
      return `https://basescan.org/tx/${txId}`;
    case 'starknet':
      return `https://voyager.online/tx/${txId}`;
    default:
      return undefined;
  }
}
