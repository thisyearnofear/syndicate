"use client";

/**
 * Unified storage service that handles browser compatibility and SSR
 * Centralizes all storage operations to maintain DRY principles
 */
export class StorageService {
  private static instance: StorageService;

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Check if we're in a browser environment
   */
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Safe localStorage operations
   */
  localStorage = {
    getItem: (key: string): string | null => {
      if (!this.isBrowser()) return null;
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        console.warn(`Failed to get localStorage item ${key}:`, error);
        return null;
      }
    },

    setItem: (key: string, value: string): boolean => {
      if (!this.isBrowser()) return false;
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn(`Failed to set localStorage item ${key}:`, error);
        return false;
      }
    },

    removeItem: (key: string): boolean => {
      if (!this.isBrowser()) return false;
      try {
        window.localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.warn(`Failed to remove localStorage item ${key}:`, error);
        return false;
      }
    },

    clear: (): boolean => {
      if (!this.isBrowser()) return false;
      try {
        window.localStorage.clear();
        return true;
      } catch (error) {
        console.warn('Failed to clear localStorage:', error);
        return false;
      }
    },
  };

  /**
   * Safe sessionStorage operations
   */
  sessionStorage = {
    getItem: (key: string): string | null => {
      if (!this.isBrowser()) return null;
      try {
        return window.sessionStorage.getItem(key);
      } catch (error) {
        console.warn(`Failed to get sessionStorage item ${key}:`, error);
        return null;
      }
    },

    setItem: (key: string, value: string): boolean => {
      if (!this.isBrowser()) return false;
      try {
        window.sessionStorage.setItem(key, value);
        return true;
      } catch (error) {
        console.warn(`Failed to set sessionStorage item ${key}:`, error);
        return false;
      }
    },

    removeItem: (key: string): boolean => {
      if (!this.isBrowser()) return false;
      try {
        window.sessionStorage.removeItem(key);
        return true;
      } catch (error) {
        console.warn(`Failed to remove sessionStorage item ${key}:`, error);
        return false;
      }
    },

    clear: (): boolean => {
      if (!this.isBrowser()) return false;
      try {
        window.sessionStorage.clear();
        return true;
      } catch (error) {
        console.warn('Failed to clear sessionStorage:', error);
        return false;
      }
    },
  };

  /**
   * JSON-safe operations for complex objects
   */
  setJSON<T>(storage: 'local' | 'session', key: string, value: T): boolean {
    try {
      const jsonString = JSON.stringify(value);
      return storage === 'local' 
        ? this.localStorage.setItem(key, jsonString)
        : this.sessionStorage.setItem(key, jsonString);
    } catch (error) {
      console.warn(`Failed to set JSON ${storage}Storage item ${key}:`, error);
      return false;
    }
  }

  getJSON<T>(storage: 'local' | 'session', key: string): T | null {
    try {
      const jsonString = storage === 'local' 
        ? this.localStorage.getItem(key)
        : this.sessionStorage.getItem(key);
      
      if (!jsonString) return null;
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.warn(`Failed to get JSON ${storage}Storage item ${key}:`, error);
      return null;
    }
  }

  /**
   * Create a storage adapter for wagmi/external libraries
   */
  createWagmiStorage() {
    return {
      getItem: this.localStorage.getItem,
      setItem: this.localStorage.setItem,
      removeItem: this.localStorage.removeItem,
    };
  }

  /**
   * Storage keys constants to avoid duplication
   */
  static readonly KEYS = {
    // MetaMask Delegation
    PERMISSION: 'syndicate_permission',
    SESSION_PRIVATE_KEY: 'syndicate_session_private_key',
    
    // Cross-chain
    CROSS_CHAIN_INTENTS: 'syndicate_cross_chain_intents',
    NEAR_WALLET_AUTH: 'near-wallet-selector:selectedWalletId',
    
    // Wagmi
    WAGMI_STORE: 'wagmi.store',
    
    // UI State
    LAST_CONNECTED_WALLET: 'syndicate_last_wallet',
    USER_PREFERENCES: 'syndicate_user_preferences',
  } as const;
}

// Export singleton instance
export const storageService = StorageService.getInstance();
