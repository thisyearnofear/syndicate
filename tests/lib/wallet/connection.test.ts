/**
 * WALLET CONNECTION RESILIENCE TESTS
 * 
 * Tests for wallet error handling and address utilities.
 */

import {
  getWalletErrorMessage,
  isRecoverableWalletError,
  isValidAddress,
  shortenAddress,
  addressesEqual,
  WalletStateMachine,
  WALLET_ERRORS,
} from '@/lib/wallet/connection';

describe('Wallet Connection Resilience', () => {
  describe('getWalletErrorMessage', () => {
    it('should return user-friendly message for user rejected', () => {
      const error = new Error('User rejected the request');
      expect(getWalletErrorMessage(error)).toBe(WALLET_ERRORS.USER_REJECTED.message);
    });

    it('should return user-friendly message for disconnected', () => {
      const error = new Error('Wallet disconnected');
      expect(getWalletErrorMessage(error)).toBe(WALLET_ERRORS.DISCONNECTED.message);
    });

    it('should return user-friendly message for timeout', () => {
      const error = new Error('Connection timeout');
      expect(getWalletErrorMessage(error)).toBe(WALLET_ERRORS.TIMEOUT.message);
    });

    it('should return original message for unknown errors', () => {
      const error = new Error('Custom error message');
      expect(getWalletErrorMessage(error)).toBe('Custom error message');
    });

    it('should return default message for non-Error objects', () => {
      expect(getWalletErrorMessage('string error')).toBe(WALLET_ERRORS.UNKNOWN.message);
      expect(getWalletErrorMessage(null)).toBe(WALLET_ERRORS.UNKNOWN.message);
    });
  });

  describe('isRecoverableWalletError', () => {
    it('should identify user rejected as recoverable', () => {
      const error = new Error('User rejected');
      expect(isRecoverableWalletError(error)).toBe(true);
    });

    it('should identify disconnected as recoverable', () => {
      const error = new Error('Disconnected');
      expect(isRecoverableWalletError(error)).toBe(true);
    });

    it('should identify unauthorized as non-recoverable', () => {
      const error = new Error('Unauthorized');
      expect(isRecoverableWalletError(error)).toBe(false);
    });

    it('should default to recoverable for unknown errors', () => {
      expect(isRecoverableWalletError(new Error('Unknown'))).toBe(true);
    });
  });

  describe('isValidAddress', () => {
    it('should validate EVM addresses', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88')).toBe(true);
      expect(isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    it('should validate Solana addresses', () => {
      // Solana addresses are base58, 32-44 characters (no 0, O, I, l)
      expect(isValidAddress('11111111111111111111111111111111')).toBe(true);
      expect(isValidAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
    });

    it('should validate Stacks addresses', () => {
      // Stacks addresses start with SP or SM followed by 30-40 alphanumeric chars
      expect(isValidAddress('SP12345678901234567890123456789012345')).toBe(true);
      expect(isValidAddress('SM12345678901234567890123456789012345')).toBe(true);
    });

    it('should reject empty address', () => {
      expect(isValidAddress('')).toBe(false);
    });
  });

  describe('shortenAddress', () => {
    it('should shorten long addresses', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88';
      expect(shortenAddress(address)).toBe('0x742d...bD88');
    });

    it('should not shorten short addresses', () => {
      const address = '0x123';
      expect(shortenAddress(address)).toBe('0x123');
    });

    it('should handle empty address', () => {
      expect(shortenAddress('')).toBe('');
    });

    it('should use custom character count', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88';
      // With chars=6, we get 0x + 6 chars + ... + 6 chars
      expect(shortenAddress(address, 6)).toBe('0x742d35...f2bD88');
    });
  });

  describe('addressesEqual', () => {
    it('should compare EVM addresses case-insensitively', () => {
      expect(addressesEqual(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88',
        '0x742d35cc6634c0532925a3b844bc9e7595f2bd88'
      )).toBe(true);
    });

    it('should compare other addresses exactly', () => {
      expect(addressesEqual('So1anaAddress', 'So1anaAddress')).toBe(true);
      expect(addressesEqual('So1anaAddress', 'so1anaaddress')).toBe(false);
    });

    it('should handle empty addresses', () => {
      expect(addressesEqual('', '')).toBe(false);
      expect(addressesEqual('0x123', '')).toBe(false);
    });
  });

  describe('WalletStateMachine', () => {
    let stateMachine: WalletStateMachine;

    beforeEach(() => {
      stateMachine = new WalletStateMachine();
    });

    it('should start in disconnected state', () => {
      expect(stateMachine.getState()).toBe('disconnected');
    });

    it('should transition to connecting state', () => {
      stateMachine.connect();
      expect(stateMachine.getState()).toBe('connecting');
    });

    it('should transition to connected state', () => {
      stateMachine.connect();
      stateMachine.connected();
      expect(stateMachine.getState()).toBe('connected');
    });

    it('should transition to disconnected state', () => {
      stateMachine.connect();
      stateMachine.connected();
      stateMachine.disconnect();
      expect(stateMachine.getState()).toBe('disconnected');
    });

    it('should transition to error state', () => {
      stateMachine.connect();
      stateMachine.error();
      expect(stateMachine.getState()).toBe('error');
    });

    it('should notify listeners on state change', () => {
      const listener = jest.fn();
      stateMachine.subscribe(listener);
      
      stateMachine.connect();
      
      expect(listener).toHaveBeenCalledWith('connecting');
    });

    it('should allow unsubscribing listeners', () => {
      const listener = jest.fn();
      const unsubscribe = stateMachine.subscribe(listener);
      
      unsubscribe();
      stateMachine.connect();
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should not notify listeners if state unchanged', () => {
      const listener = jest.fn();
      stateMachine.subscribe(listener);
      
      stateMachine.disconnect(); // Already disconnected
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
