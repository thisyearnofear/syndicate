/**
 * Bridge Configuration
 * Single source of truth for cross-chain bridge metadata
 */

export type SupportedChain = 'stacks' | 'near' | 'solana' | 'base';

export interface BridgeConfig {
  name: string;
  fees: {
    bridge: number; // USD
    gas: number;    // USD (estimated)
  };
  timing: {
    estimate: string;
    description: string;
  };
  explorer: {
    name: string;
    txUrl: (txHash: string) => string;
  };
}

export const BRIDGE_CONFIG: Record<SupportedChain, BridgeConfig> = {
  stacks: {
    name: 'Stacks',
    fees: {
      bridge: 0.10,
      gas: 0.05,
    },
    timing: {
      estimate: '30-60 seconds',
      description: 'Stacks confirmation + Base execution',
    },
    explorer: {
      name: 'Stacks Explorer',
      txUrl: (txHash) => `https://explorer.stacks.co/txid/${txHash}?chain=mainnet`,
    },
  },
  near: {
    name: 'NEAR',
    fees: {
      bridge: 0.30,
      gas: 0.02,
    },
    timing: {
      estimate: '3-5 minutes',
      description: 'Bridge + Chain Signatures execution',
    },
    explorer: {
      name: 'NEAR Explorer',
      txUrl: (txHash) => `https://explorer.near.org/transactions/${txHash}`,
    },
  },
  solana: {
    name: 'Solana',
    fees: {
      bridge: 0.50,
      gas: 0.01,
    },
    timing: {
      estimate: '1-3 minutes',
      description: 'deBridge solver + Base execution',
    },
    explorer: {
      name: 'Solscan',
      txUrl: (txHash) => `https://solscan.io/tx/${txHash}`,
    },
  },
  base: {
    name: 'Base',
    fees: {
      bridge: 0,
      gas: 0.10,
    },
    timing: {
      estimate: 'Instant',
      description: 'Direct on-chain execution',
    },
    explorer: {
      name: 'Basescan',
      txUrl: (txHash) => `https://basescan.org/tx/${txHash}`,
    },
  },
};

/**
 * Calculate total cost for a purchase
 */
export function calculateTotalCost(chain: SupportedChain, ticketCount: number): number {
  const config = BRIDGE_CONFIG[chain];
  const ticketCost = ticketCount * 1.0; // $1 per ticket
  return ticketCost + config.fees.bridge + config.fees.gas;
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(chain: SupportedChain, txHash: string): string {
  return BRIDGE_CONFIG[chain].explorer.txUrl(txHash);
}
