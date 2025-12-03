/**
 * WORMHOLE STUBS
 * 
 * Lightweight type stubs for @wormhole-foundation/* packages.
 * These allow the codebase to compile without the heavy Wormhole dependencies.
 * 
 * TO RE-ENABLE WORMHOLE:
 * 1. Add back to package.json:
 *    "@wormhole-foundation/sdk": "^4.0.2",
 *    "@wormhole-foundation/sdk-evm": "^4.0.2",
 *    "@wormhole-foundation/sdk-solana": "^4.0.2"
 * 2. Replace imports from '@/stubs/wormhole' back to '@wormhole-foundation/*'
 * 3. Run npm install
 */

// Chain types
export type Chain = 'Solana' | 'Ethereum' | 'Base' | 'Avalanche' | 'Polygon' | 'Arbitrum' | 'Optimism';
export type Network = 'Mainnet' | 'Testnet' | 'Devnet';

// Platform types
export interface Platform {
  chain: Chain;
}

// Wormhole class stub
export class Wormhole {
  constructor(_network: Network, _platforms: Platform[]) {
    console.warn('[STUB] Wormhole initialized - Wormhole is disabled');
  }
  
  async getChain(_chain: Chain): Promise<ChainContext> {
    throw new Error('[STUB] Wormhole is disabled - re-enable Wormhole packages to use this feature');
  }
}

export interface ChainContext {
  chain: Chain;
  network: Network;
}

// Token Bridge stub
export interface TokenBridge {
  transfer(params: unknown): Promise<unknown>;
  redeem(params: unknown): Promise<unknown>;
}

// Address types
export interface ChainAddress {
  chain: Chain;
  address: string;
}

export interface TokenId {
  chain: Chain;
  address: string;
}

// Signer types
export interface Signer {
  chain(): Chain;
  address(): string;
  sign(message: Uint8Array): Promise<Uint8Array>;
}

// Transaction types
export interface WormholeTransaction {
  txid: string;
  chain: Chain;
}

// VAA types
export interface VAA {
  emitterChain: Chain;
  emitterAddress: string;
  sequence: bigint;
  payload: Uint8Array;
}

// Stub functions
export function wormhole(_network: Network, _platforms: Platform[]): Wormhole {
  console.warn('[STUB] wormhole() called - Wormhole is disabled');
  return new Wormhole(_network, _platforms);
}

export function chainToPlatform(_chain: Chain): string {
  return 'Evm';
}

export function isChain(_value: unknown): _value is Chain {
  return typeof _value === 'string';
}

// Platform stubs (would normally be imported from sdk/evm, sdk/solana)
export const evm = {
  Platform: class EvmPlatform implements Platform {
    chain: Chain = 'Ethereum';
  }
};

export const solana = {
  Platform: class SolanaPlatform implements Platform {
    chain: Chain = 'Solana';
  }
};

// Export a disabled flag for runtime checks
export const WORMHOLE_ENABLED = false;
