/**
 * GLOBAL TYPE DECLARATIONS
 * 
 * Core Principles Applied:
 * - CLEAN: Clear type definitions for wallet providers
 * - DRY: Single source of truth for global types
 */

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface PhantomProvider {
  ethereum: EthereumProvider;
  isPhantom?: boolean;
}

interface SolanaProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    phantom?: PhantomProvider;
    solana?: SolanaProvider;
  }
  var __txTimestampCache: Map<string, string>;
}

export {};
