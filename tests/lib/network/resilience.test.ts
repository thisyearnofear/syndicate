/**
 * NETWORK RESILIENCE UTILITIES TESTS
 * 
 * Tests for retry logic, timeout handling, and error recovery.
 */

import {
  sleep,
  calculateBackoffDelay,
  isRetryableError,
  withRetry,
  withTimeout,
  withResilience,
  resilientFetch,
  safeJsonParse,
  safeAsync,
  RateLimiter,
  CircuitBreaker,
} from '@/lib/network/resilience';

describe('Network Resilience Utilities', () => {

  describe('sleep', () => {
    it('should wait for specified duration', async () => {
      jest.useFakeTimers();
      const promise = sleep(1000);
      jest.advanceTimersByTime(1000);
      await promise;
      jest.useRealTimers();
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff', () => {
      const delay1 = calculateBackoffDelay(1, 1000, 10000);
      const delay2 = calculateBackoffDelay(2, 1000, 10000);
      const delay3 = calculateBackoffDelay(3, 1000, 10000);

      // With jitter, we can only verify approximate ranges
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1300);
      
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(2600);
      
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(5200);
    });

    it('should cap at max delay', () => {
      const delay = calculateBackoffDelay(10, 1000, 5000);
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable network errors', () => {
      expect(isRetryableError(new Error('NETWORK_ERROR'), ['NETWORK_ERROR'])).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'), ['ECONNRESET'])).toBe(true);
      expect(isRetryableError(new Error('TIMEOUT'), ['TIMEOUT'])).toBe(true);
    });

    it('should not retry non-network errors', () => {
      expect(isRetryableError(new Error('Invalid input'), ['NETWORK_ERROR'])).toBe(false);
      expect(isRetryableError(new Error('Unauthorized'), ['NETWORK_ERROR'])).toBe(false);
    });

    it('should handle non-Error objects', () => {
      expect(isRetryableError('string error', ['NETWORK_ERROR'])).toBe(false);
      expect(isRetryableError(null, ['NETWORK_ERROR'])).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry non-retryable errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Invalid input'));
      
      await expect(withRetry(fn, { baseDelay: 1 })).rejects.toThrow('Invalid input');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('withTimeout', () => {
    it('should complete before timeout', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await withTimeout(fn, { timeout: 1000 });
      
      expect(result).toBe('success');
    });
  });

  // Note: withResilience integration tests are in separate file due to timer complexity

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('should return default on invalid JSON', () => {
      const result = safeJsonParse('invalid json', { default: true });
      expect(result).toEqual({ default: true });
    });
  });

  describe('safeAsync', () => {
    it('should return result on success', async () => {
      const result = await safeAsync(
        async () => 'success',
        'Error message',
        'default'
      );
      expect(result).toBe('success');
    });

    it('should return default on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await safeAsync(
        async () => { throw new Error('Failed'); },
        'Error message',
        'default'
      );
      
      expect(result).toBe('default');
      consoleSpy.mockRestore();
    });
  });

  describe('RateLimiter', () => {
    it('should allow requests within limit', async () => {
      const limiter = new RateLimiter(5, 10);
      
      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();
      
      // Should succeed without delay
    });
  });

  describe('CircuitBreaker', () => {
    it('should allow requests when closed', async () => {
      const breaker = new CircuitBreaker(3, 1000);
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await breaker.execute(fn);
      
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });

    it('should open after threshold failures', async () => {
      const breaker = new CircuitBreaker(2, 1000);
      const fn = jest.fn().mockRejectedValue(new Error('Failed'));
      
      // First two failures
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      
      expect(breaker.getState()).toBe('open');
      
      // Third call should be blocked
      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is open');
    });

    it('should reset after timeout', async () => {
      jest.useFakeTimers();
      
      const breaker = new CircuitBreaker(2, 1000);
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValue('success');
      
      // Open the breaker
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      
      expect(breaker.getState()).toBe('open');
      
      // Wait for reset timeout
      jest.advanceTimersByTime(1001);
      
      // Should now be half-open and allow the request
      const result = await breaker.execute(fn);
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
      
      jest.useRealTimers();
    });
  });
});
