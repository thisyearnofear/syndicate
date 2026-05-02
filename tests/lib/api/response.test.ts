/**
 * SHARED API RESPONSE UTILITIES TESTS
 *
 * Tests for CORS headers, rate limiting, input validators, and safe error messages.
 */

import {
  getCorsHeaders,
  checkRateLimit,
  isValidAddress,
  isValidSolanaAddress,
  isValidNearAddress,
  isValidStacksAddress,
  isValidTxHash,
  parsePositiveNumber,
  getSafeErrorMessage,
} from '@/lib/api/response';

describe('API Response Utilities', () => {
  // =========================================================================
  // getCorsHeaders
  // =========================================================================

  describe('getCorsHeaders', () => {
    it('returns allowed origin when origin is in ALLOWED_ORIGINS', () => {
      const headers = getCorsHeaders('https://syndicate.app');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://syndicate.app');
    });

    it('returns first allowed origin when origin is not in list', () => {
      const headers = getCorsHeaders('https://evil.com');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://syndicate.app');
    });

    it('returns first allowed origin when origin is null', () => {
      const headers = getCorsHeaders(null);
      expect(headers['Access-Control-Allow-Origin']).toBe('https://syndicate.app');
    });

    it('returns first allowed origin when origin is undefined', () => {
      const headers = getCorsHeaders(undefined);
      expect(headers['Access-Control-Allow-Origin']).toBe('https://syndicate.app');
    });

    it('includes standard CORS headers', () => {
      const headers = getCorsHeaders('https://syndicate.app');
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
      expect(headers['Access-Control-Max-Age']).toBe('86400');
    });
  });

  // =========================================================================
  // checkRateLimit
  // =========================================================================

  describe('checkRateLimit', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('allows requests within limit', () => {
      const result = checkRateLimit('test-within-limit', {
        windowMs: 60_000,
        maxRequests: 5,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('blocks requests when limit exceeded', () => {
      const id = 'test-exceeded';
      const config = { windowMs: 60_000, maxRequests: 3 };

      checkRateLimit(id, config);
      checkRateLimit(id, config);
      checkRateLimit(id, config);
      const result = checkRateLimit(id, config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('resets after window expires', () => {
      jest.useFakeTimers();

      const id = 'test-reset';
      const config = { windowMs: 1_000, maxRequests: 2 };

      checkRateLimit(id, config);
      checkRateLimit(id, config);
      const blocked = checkRateLimit(id, config);
      expect(blocked.allowed).toBe(false);

      jest.advanceTimersByTime(1_001);

      const afterReset = checkRateLimit(id, config);
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBe(1);
    });

    it('returns remaining count correctly', () => {
      const id = 'test-remaining';
      const config = { windowMs: 60_000, maxRequests: 5 };

      const r1 = checkRateLimit(id, config);
      const r2 = checkRateLimit(id, config);
      const r3 = checkRateLimit(id, config);

      expect(r1.remaining).toBe(4);
      expect(r2.remaining).toBe(3);
      expect(r3.remaining).toBe(2);
    });
  });

  // =========================================================================
  // Input validators
  // =========================================================================

  describe('isValidAddress', () => {
    it('accepts valid 0x addresses', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88')).toBe(true);
      expect(isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    it('rejects invalid addresses', () => {
      expect(isValidAddress('')).toBe(false);
      expect(isValidAddress('0x')).toBe(false);
      expect(isValidAddress('742d35Cc6634C0532925a3b844Bc9e7595f2bD88')).toBe(false);
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD8')).toBe(false);
      expect(isValidAddress('0xGGGG35Cc6634C0532925a3b844Bc9e7595f2bD88')).toBe(false);
    });
  });

  describe('isValidSolanaAddress', () => {
    it('accepts valid base58 addresses', () => {
      expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true);
      expect(isValidSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
    });

    it('rejects invalid addresses', () => {
      expect(isValidSolanaAddress('')).toBe(false);
      expect(isValidSolanaAddress('short')).toBe(false);
      expect(isValidSolanaAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88')).toBe(false);
    });
  });

  describe('isValidNearAddress', () => {
    it('accepts valid .near addresses', () => {
      expect(isValidNearAddress('alice.near')).toBe(true);
      expect(isValidNearAddress('my-account.near')).toBe(true);
    });

    it('accepts valid 64-char hex addresses', () => {
      const hex64 = 'a'.repeat(64);
      expect(isValidNearAddress(hex64)).toBe(true);
    });

    it('rejects invalid addresses', () => {
      expect(isValidNearAddress('')).toBe(false);
      expect(isValidNearAddress('alice.eth')).toBe(false);
      expect(isValidNearAddress('a'.repeat(63))).toBe(false);
      expect(isValidNearAddress('g'.repeat(64))).toBe(false);
    });
  });

  describe('isValidStacksAddress', () => {
    it('accepts valid SP/ST addresses', () => {
      expect(isValidStacksAddress('SP1234567890123456789012345678')).toBe(true);
      expect(isValidStacksAddress('ST1234567890123456789012345678')).toBe(true);
    });

    it('rejects invalid addresses', () => {
      expect(isValidStacksAddress('')).toBe(false);
      expect(isValidStacksAddress('SX1234567890123456789012345678')).toBe(false);
      expect(isValidStacksAddress('SP123')).toBe(false);
    });
  });

  describe('isValidTxHash', () => {
    it('accepts valid 0x transaction hashes', () => {
      expect(isValidTxHash('0x' + 'a'.repeat(64))).toBe(true);
      expect(isValidTxHash('0x' + '0'.repeat(64))).toBe(true);
      expect(isValidTxHash('0x' + 'abcdef0123456789'.repeat(4))).toBe(true);
    });

    it('rejects invalid hashes', () => {
      expect(isValidTxHash('')).toBe(false);
      expect(isValidTxHash('0x')).toBe(false);
      expect(isValidTxHash('0x' + 'a'.repeat(63))).toBe(false);
      expect(isValidTxHash('0x' + 'a'.repeat(65))).toBe(false);
      expect(isValidTxHash('a'.repeat(64))).toBe(false);
    });
  });

  describe('parsePositiveNumber', () => {
    it('parses valid numbers', () => {
      expect(parsePositiveNumber(42)).toBe(42);
      expect(parsePositiveNumber(3.14)).toBe(3.14);
    });

    it('parses numeric strings', () => {
      expect(parsePositiveNumber('100')).toBe(100);
      expect(parsePositiveNumber('3.14')).toBe(3.14);
    });

    it('rejects negatives and zero', () => {
      expect(parsePositiveNumber(-1)).toBeNull();
      expect(parsePositiveNumber(0)).toBeNull();
      expect(parsePositiveNumber('-5')).toBeNull();
      expect(parsePositiveNumber('0')).toBeNull();
    });

    it('rejects null and non-numeric input', () => {
      expect(parsePositiveNumber(null)).toBeNull();
      expect(parsePositiveNumber(undefined)).toBeNull();
      expect(parsePositiveNumber('abc')).toBeNull();
      expect(parsePositiveNumber(NaN)).toBeNull();
      expect(parsePositiveNumber(Infinity)).toBeNull();
    });
  });

  // =========================================================================
  // getSafeErrorMessage
  // =========================================================================

  describe('getSafeErrorMessage', () => {
    it('returns Error.message for Error instances', () => {
      expect(getSafeErrorMessage(new Error('something broke'))).toBe('something broke');
    });

    it('returns string for string input', () => {
      expect(getSafeErrorMessage('raw error')).toBe('raw error');
    });

    it('returns fallback for unknown input', () => {
      expect(getSafeErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getSafeErrorMessage(undefined)).toBe('An unexpected error occurred');
      expect(getSafeErrorMessage(42)).toBe('An unexpected error occurred');
      expect(getSafeErrorMessage({})).toBe('An unexpected error occurred');
    });
  });
});
