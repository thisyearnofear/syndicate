/**
 * TESTS — Analytics Subscriber
 *
 * Validates:
 *   - Session creation on initiation events
 *   - Step accumulation for intermediate events
 *   - Session completion with duration calculation
 *   - Session failure with error capture
 *   - Buffer flush behavior
 *   - Drop-off detection (failed sessions have error info)
 */

import { lifecycle } from '@/services/observability';
import {
  analyticsSubscriber,
  getAnalyticsSnapshot,
  resetAnalytics,
} from '@/services/observability/analyticsSubscriber';

describe('Analytics Subscriber', () => {
  beforeEach(() => {
    lifecycle.reset();
    resetAnalytics();
    // Register only the analytics subscriber (no console/logger noise)
    lifecycle.subscribe(analyticsSubscriber);
  });

  describe('session tracking', () => {
    it('creates a session on purchase.initiated', () => {
      lifecycle.emit('purchase.initiated', {
        chain: 'base',
        operation: 'purchase',
        provider: 'megapot',
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      });

      const snapshot = getAnalyticsSnapshot();
      expect(snapshot.activeSessions).toHaveLength(1);
      expect(snapshot.activeSessions[0].operation).toBe('purchase');
      expect(snapshot.activeSessions[0].chain).toBe('base');
      expect(snapshot.activeSessions[0].outcome).toBe('in_progress');
    });

    it('creates a session on vault.deposit_initiated', () => {
      lifecycle.emit('vault.deposit_initiated', {
        chain: 'base',
        operation: 'deposit',
        provider: 'aave',
        userAddress: '0xBBBB',
      });

      const snapshot = getAnalyticsSnapshot();
      expect(snapshot.activeSessions).toHaveLength(1);
      expect(snapshot.activeSessions[0].provider).toBe('aave');
    });

    it('accumulates intermediate steps', () => {
      lifecycle.emit('purchase.initiated', {
        chain: 'base',
        operation: 'purchase',
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      });
      lifecycle.emit('purchase.signature_requested', {
        chain: 'base',
        operation: 'purchase',
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      });
      lifecycle.emit('purchase.submitted', {
        chain: 'base',
        operation: 'purchase',
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        transactionHash: '0x123',
      });

      const snapshot = getAnalyticsSnapshot();
      expect(snapshot.activeSessions[0].steps).toHaveLength(3);
      expect(snapshot.activeSessions[0].steps[1].event).toBe('purchase.signature_requested');
      expect(snapshot.activeSessions[0].steps[2].event).toBe('purchase.submitted');
    });
  });

  describe('session completion', () => {
    it('completes a session on purchase.confirmed', () => {
      lifecycle.emit('purchase.initiated', {
        chain: 'base',
        operation: 'purchase',
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      });
      lifecycle.emit('purchase.confirmed', {
        chain: 'base',
        operation: 'purchase',
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        transactionHash: '0xabc',
      });

      const snapshot = getAnalyticsSnapshot();
      expect(snapshot.activeSessions).toHaveLength(0);
      expect(snapshot.buffered).toHaveLength(1);
      expect(snapshot.buffered[0].outcome).toBe('completed');
      expect(snapshot.buffered[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(snapshot.buffered[0].completedAt).not.toBeNull();
    });

    it('completes a session on vault.deposit_confirmed', () => {
      lifecycle.emit('vault.deposit_initiated', {
        chain: 'base',
        operation: 'deposit',
        provider: 'morpho',
        userAddress: '0xCCCC',
      });
      lifecycle.emit('vault.deposit_confirmed', {
        chain: 'base',
        operation: 'deposit',
        provider: 'morpho',
        userAddress: '0xCCCC',
        transactionHash: '0xdef',
      });

      const snapshot = getAnalyticsSnapshot();
      expect(snapshot.buffered).toHaveLength(1);
      expect(snapshot.buffered[0].outcome).toBe('completed');
      expect(snapshot.buffered[0].provider).toBe('morpho');
    });
  });

  describe('session failure', () => {
    it('marks session as failed on purchase.failed', () => {
      lifecycle.emit('purchase.initiated', {
        chain: 'stacks',
        operation: 'purchase',
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      });
      lifecycle.emit('purchase.failed', {
        chain: 'stacks',
        operation: 'purchase',
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        error: {
          code: 'USER_REJECTED',
          message: 'User rejected',
          phase: 'pending_signature',
          userCancelled: true,
        },
      });

      const snapshot = getAnalyticsSnapshot();
      expect(snapshot.activeSessions).toHaveLength(0);
      expect(snapshot.buffered).toHaveLength(1);
      expect(snapshot.buffered[0].outcome).toBe('failed');
      expect(snapshot.buffered[0].error).toEqual({
        code: 'USER_REJECTED',
        phase: 'pending_signature',
        userCancelled: true,
      });
    });

    it('captures drop-off point from steps', () => {
      lifecycle.emit('purchase.initiated', {
        chain: 'base',
        operation: 'purchase',
        userAddress: '0xDDDD',
      });
      lifecycle.emit('purchase.signature_requested', {
        chain: 'base',
        operation: 'purchase',
        userAddress: '0xDDDD',
      });
      lifecycle.emit('purchase.failed', {
        chain: 'base',
        operation: 'purchase',
        userAddress: '0xDDDD',
        error: {
          code: 'REVERTED',
          message: 'Transaction reverted',
          phase: 'confirming',
          userCancelled: false,
        },
      });

      const snapshot = getAnalyticsSnapshot();
      const session = snapshot.buffered[0];
      expect(session.steps).toHaveLength(3);
      expect(session.error!.phase).toBe('confirming');
      expect(session.error!.userCancelled).toBe(false);
    });
  });

  describe('multiple concurrent sessions', () => {
    it('tracks sessions independently by key', () => {
      lifecycle.emit('purchase.initiated', {
        chain: 'base',
        operation: 'purchase',
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      });
      lifecycle.emit('vault.deposit_initiated', {
        chain: 'base',
        operation: 'deposit',
        provider: 'aave',
        userAddress: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      });

      const snapshot = getAnalyticsSnapshot();
      expect(snapshot.activeSessions).toHaveLength(2);
    });
  });

  describe('resetAnalytics()', () => {
    it('clears all active and buffered sessions', () => {
      lifecycle.emit('purchase.initiated', { chain: 'base', operation: 'purchase', userAddress: '0xAAAA' });
      lifecycle.emit('purchase.confirmed', { chain: 'base', operation: 'purchase', userAddress: '0xAAAA' });

      resetAnalytics();

      const snapshot = getAnalyticsSnapshot();
      expect(snapshot.activeSessions).toHaveLength(0);
      expect(snapshot.buffered).toHaveLength(0);
    });
  });
});
