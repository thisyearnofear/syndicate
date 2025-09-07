import { createPublicClient, http } from 'viem';
import { base, baseSepolia, avalanche } from 'viem/chains';

// Public client for Base mainnet
export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
});

// Public client for Base Sepolia (testnet)
export const baseSepoliaPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
});

// Public client for Avalanche
export const avalanchePublicClient = createPublicClient({
  chain: avalanche,
  transport: http(process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL),
});

// Helper function to get the correct public client based on chain ID
export const getPublicClient = (chainId: number) => {
  switch (chainId) {
    case base.id:
      return basePublicClient;
    case baseSepolia.id:
      return baseSepoliaPublicClient;
    case avalanche.id:
      return avalanchePublicClient;
    default:
      return basePublicClient; // Default to Base mainnet
  }
};

// Default export for backward compatibility
export const publicClient = basePublicClient;
