/**
 * WEB3AUTH STUBS
 * 
 * Lightweight type stubs for @web3auth/* packages.
 * These allow the codebase to compile without the heavy Web3Auth dependencies.
 * 
 * TO RE-ENABLE WEB3AUTH:
 * 1. Add back to package.json:
 *    "@web3auth/base": "^9.7.0",
 *    "@web3auth/ethereum-provider": "^9.7.0",
 *    "@web3auth/modal": "^10.3.1",
 *    "@web3auth/solana-provider": "^9.7.0"
 * 2. Replace imports from '@/stubs/web3auth' back to '@web3auth/*'
 * 3. Run npm install
 */

// Chain namespaces
export const CHAIN_NAMESPACES = {
  EIP155: 'eip155',
  SOLANA: 'solana',
  OTHER: 'other',
} as const;

export type ChainNamespaceType = typeof CHAIN_NAMESPACES[keyof typeof CHAIN_NAMESPACES];

// Network types
export const WEB3AUTH_NETWORK = {
  MAINNET: 'mainnet',
  TESTNET: 'testnet',
  CYAN: 'cyan',
  AQUA: 'aqua',
  SAPPHIRE_MAINNET: 'sapphire_mainnet',
  SAPPHIRE_DEVNET: 'sapphire_devnet',
} as const;

export type Web3AuthNetwork = typeof WEB3AUTH_NETWORK[keyof typeof WEB3AUTH_NETWORK];

// Provider interface
export interface IProvider {
  request<T>(args: { method: string; params?: unknown[] }): Promise<T>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
}

// Web3Auth options
export interface Web3AuthOptions {
  clientId: string;
  web3AuthNetwork: Web3AuthNetwork;
  chainConfig?: ChainConfig;
  privateKeyProvider?: unknown;
}

export interface ChainConfig {
  chainNamespace: ChainNamespaceType;
  chainId: string;
  rpcTarget: string;
  displayName?: string;
  blockExplorer?: string;
  ticker?: string;
  tickerName?: string;
}

// Web3Auth context config
export interface Web3AuthContextConfig {
  web3AuthOptions: Web3AuthOptions;
}

// Solana provider stub
export class SolanaPrivateKeyProvider {
  constructor(_config: { config: { chainConfig: ChainConfig } }) {
    console.warn('[STUB] SolanaPrivateKeyProvider created - Web3Auth is disabled');
  }
  
  async setupProvider(_privateKey: string): Promise<IProvider> {
    throw new Error('[STUB] Web3Auth is disabled - re-enable Web3Auth packages to use this feature');
  }
}

// Ethereum provider stub
export class EthereumPrivateKeyProvider {
  constructor(_config: { config: { chainConfig: ChainConfig } }) {
    console.warn('[STUB] EthereumPrivateKeyProvider created - Web3Auth is disabled');
  }
  
  async setupProvider(_privateKey: string): Promise<IProvider> {
    throw new Error('[STUB] Web3Auth is disabled - re-enable Web3Auth packages to use this feature');
  }
}

// Web3Auth Modal stub
export class Web3Auth {
  connected = false;
  provider: IProvider | null = null;
  
  constructor(_options: Web3AuthOptions) {
    console.warn('[STUB] Web3Auth created - Web3Auth is disabled');
  }
  
  async initModal(): Promise<void> {
    console.warn('[STUB] Web3Auth.initModal called - Web3Auth is disabled');
  }
  
  async connect(): Promise<IProvider | null> {
    throw new Error('[STUB] Web3Auth is disabled - re-enable Web3Auth packages to use social login');
  }
  
  async logout(): Promise<void> {
    console.warn('[STUB] Web3Auth.logout called - Web3Auth is disabled');
  }
  
  async getUserInfo(): Promise<{ email?: string; name?: string }> {
    return {};
  }
}

// Export a disabled flag for runtime checks
export const WEB3AUTH_ENABLED = false;
