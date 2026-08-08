/**
 * TESTS — Lifecycle Observability
 *
 * Validates:
 *   - Event emission with correct structure
 *   - Subscriber notification
 *   - History buffer (bounded)
 *   - Address sanitization (no full addresses leaked)
 *   - Error events carry structured error info
 *   - Subscriber errors don't break emission
 */

import { lifecycle } from '@/services/observability';
import type { LifecycleEvent } from '@/services/observability';

describe('Lifecycle Observability', () => {
  beforeEach(() => {
    lifecycle.reset();
  });

  describe('emit()', () => {
    it('returns a structured event with correct fields', () => {
      const event = lifecycle.emit('purchase.submitted', {
        chain: 'base',
        chainId: 8453,
        transactionHash: '0xabcdef1234567890',
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        operation: 'purchase',
        provider: 'megapot',
        metadata: { ticketCount: 5 },
      });

      expect(event.name).toBe('purchase.submitted');
      expect(event.category).toBe('purchase');
      expect(event.chain).toBe('base');
      expect(event.chainId).toBe(8453);
      expect(event.transactionHash).toBe('0xabcdef1234567890');
      expect(event.operation).toBe('purchase');
      expect(event.provider).toBe('megapot');
      expect(event.metadata.ticketCount).toBe(5);
      expect(event.error).toBeNull();
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('sanitizes user address to prefix only', () => {
      const event = lifecycle.emit('bridge.started', {
        userAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      });

      expect(event.userAddressPrefix).toBe('0xAAAAAAAA…');
      expect(event.userAddressPrefix!.length).toBeLessThan(42);
    });

    it('handles missing optional fields gracefully', () => {
      const event = lifecycle.emit('execution.state_changed');

      expect(event.chain).toBeNull();
      expect(event.chainId).toBeNull();
      expect(event.transactionHash).toBeNull();
      expect(event.userAddressPrefix).toBeNull();
      expect(event.error).toBeNull();
      expect(event.metadata).toEqual({});
    });

    it('includes error info for failure events', () => {
      const event = lifecycle.emit('purchase.failed', {
        chain: 'base',
        error: {
          code: 'REVERTED',
          message: 'Transaction reverted',
          phase: 'confirming',
          userCancelled: false,
        },
      });

      expect(event.error).not.toBeNull();
      expect(event.error!.code).toBe('REVERTED');
      expect(event.error!.phase).toBe('confirming');
      expect(event.error!.userCancelled).toBe(false);
    });
  });

  describe('subscribe()', () => {
    it('notifies subscribers of emitted events', () => {
      const received: LifecycleEvent[] = [];
      lifecycle.subscribe((e) => received.push(e));

      lifecycle.emit('vault.deposit_confirmed', { chain: 'base' });
      lifecycle.emit('automation.task_created');

      expect(received).toHaveLength(2);
      expect(received[0].name).toBe('vault.deposit_confirmed');
      expect(received[1].name).toBe('automation.task_created');
    });

    it('returns an unsubscribe function', () => {
      const received: LifecycleEvent[] = [];
      const unsub = lifecycle.subscribe((e) => received.push(e));

      lifecycle.emit('bridge.started');
      unsub();
      lifecycle.emit('bridge.confirmed');

      expect(received).toHaveLength(1);
      expect(received[0].name).toBe('bridge.started');
    });

    it('does not break emission if a subscriber throws', () => {
      lifecycle.subscribe(() => { throw new Error('subscriber crash'); });
      const received: LifecycleEvent[] = [];
      lifecycle.subscribe((e) => received.push(e));

      // Should not throw
      lifecycle.emit('purchase.initiated');

      expect(received).toHaveLength(1);
    });
  });

  describe('getHistory()', () => {
    it('retains emitted events in order', () => {
      lifecycle.emit('purchase.initiated');
      lifecycle.emit('purchase.submitted');
      lifecycle.emit('purchase.confirmed');

      const history = lifecycle.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].name).toBe('purchase.initiated');
      expect(history[2].name).toBe('purchase.confirmed');
    });

    it('is bounded (does not grow unbounded)', () => {
      for (let i = 0; i < 250; i++) {
        lifecycle.emit('execution.state_changed', { metadata: { i } });
      }

      const history = lifecycle.getHistory();
      expect(history.length).toBeLessThanOrEqual(200);
      // Most recent event should be the last emitted
      expect(history[history.length - 1].metadata.i).toBe(249);
    });
  });

  describe('reset()', () => {
    it('clears subscribers and history', () => {
      lifecycle.subscribe(() => {});
      lifecycle.emit('purchase.initiated');

      lifecycle.reset();

      expect(lifecycle.getHistory()).toHaveLength(0);
      expect(lifecycle.subscriberCount()).toBe(0);
    });
  });

  describe('category extraction', () => {
    it('extracts purchase category', () => {
      expect(lifecycle.emit('purchase.initiated').category).toBe('purchase');
    });

    it('extracts bridge category', () => {
      expect(lifecycle.emit('bridge.started').category).toBe('bridge');
    });

    it('extracts vault category', () => {
      expect(lifecycle.emit('vault.deposit_initiated').category).toBe('vault');
    });

    it('extracts automation category', () => {
      expect(lifecycle.emit('automation.task_created').category).toBe('automation');
    });

    it('extracts verification category', () => {
      expect(lifecycle.emit('verification.gate_evaluated').category).toBe('verification');
    });
  });
});
