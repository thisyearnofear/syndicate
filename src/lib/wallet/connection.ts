/**
 * WALLET CONNECTION RESILIENCE
 * 
 * Handles wallet disconnections gracefully with:
 * - Connection state monitoring
 * - Automatic reconnection attempts
 * - Graceful degradation when wallet is disconnected
 * - User-friendly error messages
 */

export type WalletState = 
  | 'connected' 
  | 'disconnected' 
  | 'connecting' 
  | 'reconnecting' 
  | 'error';

export interface WalletConnectionInfo {
  address: string;
  chainId: number;
  walletType: string;
  connectedAt: number;
}

export interface WalletError {
  code: string;
  message: string;
  recoverable: boolean;
}

export const WALLET_ERRORS: Record<string, WalletError> = {
  DISCONNECTED: {
    code: 'DISCONNECTED',
    message: 'Wallet disconnected. Please reconnect to continue.',
    recoverable: true,
  },
  CHAIN_CHANGED: {
    code: 'CHAIN_CHANGED',
    message: 'Network changed. Please switch back to the correct network.',
    recoverable: true,
  },
  ACCOUNT_CHANGED: {
    code: 'ACCOUNT_CHANGED',
    message: 'Account changed. Please reconnect with the correct account.',
    recoverable: true,
  },
  USER_REJECTED: {
    code: 'USER_REJECTED',
    message: 'Connection request was rejected. Please try again.',
    recoverable: true,
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Wallet is not authorized. Please check your wallet settings.',
    recoverable: false,
  },
  TIMEOUT: {
    code: 'TIMEOUT',
    message: 'Connection timed out. Please try again.',
    recoverable: true,
  },
  UNKNOWN: {
    code: 'UNKNOWN',
    message: 'An unexpected error occurred. Please try again.',
    recoverable: false,
  },
};

/**
 * Get user-friendly error message for wallet errors
 */
export function getWalletErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('user rejected') || message.includes('user denied')) {
      return WALLET_ERRORS.USER_REJECTED.message;
    }
    
    if (message.includes('disconnected') || message.includes('no wallet')) {
      return WALLET_ERRORS.DISCONNECTED.message;
    }
    
    if (message.includes('timeout')) {
      return WALLET_ERRORS.TIMEOUT.message;
    }
    
    if (message.includes('unauthorized') || message.includes('not authorized')) {
      return WALLET_ERRORS.UNAUTHORIZED.message;
    }
    
    return error.message;
  }
  
  return WALLET_ERRORS.UNKNOWN.message;
}

/**
 * Check if a wallet error is recoverable
 */
export function isRecoverableWalletError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('user rejected') || message.includes('user denied')) {
      return true;
    }
    
    if (message.includes('disconnected') || message.includes('no wallet')) {
      return true;
    }
    
    if (message.includes('timeout')) {
      return true;
    }
    
    if (message.includes('unauthorized')) {
      return false;
    }
  }
  
  return true;
}

/**
 * Create a wallet connection wrapper that handles disconnections
 */
export function withWalletConnection<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    onDisconnect?: () => void;
    onReconnect?: () => void;
    maxReconnectAttempts?: number;
  } = {}
): T {
  const {
    onDisconnect,
    onReconnect,
    maxReconnectAttempts = 3,
  } = options;
  
  let reconnectAttempts = 0;
  
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      const result = await fn(...args);
      reconnectAttempts = 0; // Reset on success
      return result;
    } catch (error) {
      const isRecoverable = isRecoverableWalletError(error);
      
      if (isRecoverable && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`[withWalletConnection] Recoverable error, attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
        
        if (onDisconnect) {
          onDisconnect();
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * reconnectAttempts));
        
        if (onReconnect) {
          onReconnect();
        }
        
        // Retry the operation
        return fn(...args);
      }
      
      throw error;
    }
  }) as T;
}

/**
 * Validate wallet address format
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false;
  
  // EVM address (0x...)
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return true;
  }
  
  // Solana address (base58)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return true;
  }
  
  // NEAR account
  if (/^([a-z0-9_-]+\.[a-z0-9_-]+)*[a-z0-9_-]+$/.test(address)) {
    return true;
  }
  
  // Stacks address (SP... or SM...)
  if (/^(SP|SM)[A-Z0-9]{30,40}$/.test(address)) {
    return true;
  }
  
  return false;
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Check if two addresses are equal (case-insensitive for EVM)
 */
export function addressesEqual(addr1: string, addr2: string): boolean {
  if (!addr1 || !addr2) return false;
  
  // EVM addresses: case-insensitive comparison
  if (addr1.startsWith('0x') && addr2.startsWith('0x')) {
    return addr1.toLowerCase() === addr2.toLowerCase();
  }
  
  // Other chains: exact match
  return addr1 === addr2;
}

/**
 * Wallet connection state machine
 */
export class WalletStateMachine {
  private state: WalletState = 'disconnected';
  private listeners: Set<(state: WalletState) => void> = new Set();
  
  getState(): WalletState {
    return this.state;
  }
  
  setState(newState: WalletState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.notifyListeners();
    }
  }
  
  subscribe(listener: (state: WalletState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
  
  connect(): void {
    this.setState('connecting');
  }
  
  connected(): void {
    this.setState('connected');
  }
  
  disconnect(): void {
    this.setState('disconnected');
  }
  
  reconnect(): void {
    this.setState('reconnecting');
  }
  
  error(): void {
    this.setState('error');
  }
}

/**
 * Create a debounced wallet connection check
 */
export function createWalletHealthCheck(
  checkConnection: () => Promise<boolean>,
  onDisconnect: () => void,
  intervalMs: number = 30000
): { start: () => void; stop: () => void } {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  
  const check = async () => {
    try {
      const isConnected = await checkConnection();
      if (!isConnected) {
        console.log('[WalletHealthCheck] Wallet disconnected');
        onDisconnect();
      }
    } catch (error) {
      console.error('[WalletHealthCheck] Error checking connection:', error);
    }
  };
  
  return {
    start: () => {
      if (intervalId) return;
      intervalId = setInterval(check, intervalMs);
    },
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
