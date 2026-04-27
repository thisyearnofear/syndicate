import { baseSepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

/**
 * Fhenix-enabled chain configuration.
 *
 * We support running the FHE vault on:
 * - Base Sepolia (CoFHE co-processor setup)
 * - Fhenix Helium testnet (native Fhenix RPC)
 *
 * Single source of truth:
 * - `NEXT_PUBLIC_FHENIX_CHAIN_ID` selects which chain the vault is deployed to.
 * - `NEXT_PUBLIC_FHENIX_RPC_URL` provides RPC for that chain (required for Helium).
 */

export const fhenixHelium = defineChain({
  id: 8008135,
  name: 'Fhenix Helium',
  nativeCurrency: { name: 'tFHE', symbol: 'tFHE', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_FHENIX_RPC_URL ?? 'https://api.fhenix.zone'] },
  },
  blockExplorers: {
    default: { name: 'Fhenix Explorer', url: 'https://explorer.fhenix.zone' },
  },
  testnet: true,
});

export const FHENIX_VAULT_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_FHENIX_CHAIN_ID ?? String(baseSepolia.id),
  10,
);

export const FHENIX_VAULT_CHAIN =
  FHENIX_VAULT_CHAIN_ID === fhenixHelium.id ? fhenixHelium : baseSepolia;

export const FHENIX_VAULT_RPC_URL =
  process.env.NEXT_PUBLIC_FHENIX_RPC_URL ??
  (FHENIX_VAULT_CHAIN_ID === fhenixHelium.id ? 'https://api.fhenix.zone' : undefined);

