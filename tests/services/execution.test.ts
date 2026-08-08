/**
 * TESTS — Execution State Machine Transitions
 *
 * Validates that:
 *   - Valid transitions produce the expected state
 *   - Invalid transitions throw
 *   - `completed` requires a valid ConfirmedReceipt
 *   - `failed` is reachable from any non-completed state
 *   - `completed` cannot transition to `failed`
 */

import {
  toIdle,
  toPreparing,
  toPendingSignature,
  toSubmitted,
  toConfirming,
  toBridging,
  toCompleted,
  toFailed,
} from '@/services/execution';
import type { ExecutionState, ConfirmedReceipt } from '@/services/execution';

const VALID_RECEIPT: ConfirmedReceipt = {
  transactionHash: '0xabc123',
  blockNumber: 12345678,
  chainId: 8453,
  confirmedAt: Date.now(),
};

describe('Execution State Machine', () => {
  describe('happy path: single-chain', () => {
    it('idle → preparing → pending_signature → submitted → confirming → completed', () => {
      let state: ExecutionState = toIdle();
      expect(state.status).toBe('idle');

      state = toPreparing(state, 'Simulating...');
      expect(state.status).toBe('preparing');
      if (state.status === 'preparing') expect(state.detail).toBe('Simulating...');

      state = toPendingSignature(state, 'base');
      expect(state.status).toBe('pending_signature');
      if (state.status === 'pending_signature') expect(state.chain).toBe('base');

      state = toSubmitted(state, '0x111', 8453);
      expect(state.status).toBe('submitted');
      if (state.status === 'submitted') {
        expect(state.transactionHash).toBe('0x111');
        expect(state.chainId).toBe(8453);
      }

      state = toConfirming(state, '0x111', 8453, 1);
      expect(state.status).toBe('confirming');
      if (state.status === 'confirming') expect(state.confirmations).toBe(1);

      state = toCompleted(state, VALID_RECEIPT);
      expect(state.status).toBe('completed');
      if (state.status === 'completed') {
        expect(state.receipt.transactionHash).toBe('0xabc123');
        expect(state.receipt.blockNumber).toBe(12345678);
      }
    });
  });

  describe('happy path: cross-chain (bridge)', () => {
    it('confirming → bridging → completed (with source receipt)', () => {
      let state: ExecutionState = toIdle();
      state = toPreparing(state);
      state = toPendingSignature(state, 'solana');
      state = toSubmitted(state, '0xsol1', 101);
      state = toConfirming(state, '0xsol1', 101);

      state = toBridging(state, '0xsol1', 101, 8453, 'cctp-attestation-123');
      expect(state.status).toBe('bridging');
      if (state.status === 'bridging') {
        expect(state.sourceTransactionHash).toBe('0xsol1');
        expect(state.sourceChainId).toBe(101);
        expect(state.targetChainId).toBe(8453);
        expect(state.transferId).toBe('cctp-attestation-123');
      }

      const sourceReceipt: ConfirmedReceipt = {
        transactionHash: '0xsol1',
        blockNumber: 999,
        chainId: 101,
        confirmedAt: Date.now() - 1000,
      };

      state = toCompleted(state, VALID_RECEIPT, sourceReceipt);
      expect(state.status).toBe('completed');
      if (state.status === 'completed') {
        expect(state.sourceReceipt?.transactionHash).toBe('0xsol1');
      }
    });
  });

  describe('failure transitions', () => {
    it('can fail from preparing', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toFailed(state, 'INSUFFICIENT_BALANCE', 'Not enough USDC');
      expect(state.status).toBe('failed');
      if (state.status === 'failed') {
        expect(state.error.code).toBe('INSUFFICIENT_BALANCE');
        expect(state.error.phase).toBe('preparing');
        expect(state.error.userCancelled).toBe(false);
      }
    });

    it('can fail from pending_signature with userCancelled', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toPendingSignature(state, 'base');
      state = toFailed(state, 'USER_REJECTED', 'User rejected', { userCancelled: true });
      expect(state.status).toBe('failed');
      if (state.status === 'failed') {
        expect(state.error.userCancelled).toBe(true);
        expect(state.error.phase).toBe('pending_signature');
      }
    });

    it('can fail from confirming', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toPendingSignature(state, 'base');
      state = toSubmitted(state, '0x1', 8453);
      state = toConfirming(state, '0x1', 8453);
      state = toFailed(state, 'REVERTED', 'Transaction reverted');
      if (state.status === 'failed') {
        expect(state.error.code).toBe('REVERTED');
        expect(state.error.phase).toBe('confirming');
      }
    });

    it('can fail from bridging', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toPendingSignature(state, 'solana');
      state = toSubmitted(state, '0x1', 101);
      state = toConfirming(state, '0x1', 101);
      state = toBridging(state, '0x1', 101, 8453);
      state = toFailed(state, 'BRIDGE_FAILED', 'CCTP attestation timeout');
      if (state.status === 'failed') {
        expect(state.error.code).toBe('BRIDGE_FAILED');
        expect(state.error.phase).toBe('bridging');
      }
    });

    it('cannot fail from completed', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toPendingSignature(state, 'base');
      state = toSubmitted(state, '0x1', 8453);
      state = toConfirming(state, '0x1', 8453);
      state = toCompleted(state, VALID_RECEIPT);
      expect(() => toFailed(state, 'UNKNOWN', 'should not work')).toThrow('Cannot transition from completed to failed');
    });
  });

  describe('invalid transitions', () => {
    it('cannot go from idle directly to pending_signature', () => {
      expect(() => toPendingSignature(toIdle(), 'base')).toThrow('Invalid transition');
    });

    it('cannot go from idle directly to submitted', () => {
      expect(() => toSubmitted(toIdle(), '0x1', 8453)).toThrow('Invalid transition');
    });

    it('cannot go from preparing directly to submitted', () => {
      const state = toPreparing(toIdle());
      expect(() => toSubmitted(state, '0x1', 8453)).toThrow('Invalid transition');
    });

    it('cannot go from submitted directly to completed', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toPendingSignature(state, 'base');
      state = toSubmitted(state, '0x1', 8453);
      expect(() => toCompleted(state, VALID_RECEIPT)).toThrow('Invalid transition');
    });

    it('cannot go from idle to bridging', () => {
      expect(() => toBridging(toIdle(), '0x1', 101, 8453)).toThrow('Invalid transition');
    });
  });

  describe('receipt validation', () => {
    it('rejects receipt without transactionHash', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toPendingSignature(state, 'base');
      state = toSubmitted(state, '0x1', 8453);
      state = toConfirming(state, '0x1', 8453);
      expect(() => toCompleted(state, { ...VALID_RECEIPT, transactionHash: '' })).toThrow('transactionHash');
    });

    it('rejects receipt without blockNumber', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toPendingSignature(state, 'base');
      state = toSubmitted(state, '0x1', 8453);
      state = toConfirming(state, '0x1', 8453);
      expect(() => toCompleted(state, { ...VALID_RECEIPT, blockNumber: 0 })).toThrow('blockNumber');
    });

    it('rejects receipt without chainId', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toPendingSignature(state, 'base');
      state = toSubmitted(state, '0x1', 8453);
      state = toConfirming(state, '0x1', 8453);
      expect(() => toCompleted(state, { ...VALID_RECEIPT, chainId: 0 })).toThrow('chainId');
    });

    it('rejects receipt without confirmedAt', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toPendingSignature(state, 'base');
      state = toSubmitted(state, '0x1', 8453);
      state = toConfirming(state, '0x1', 8453);
      expect(() => toCompleted(state, { ...VALID_RECEIPT, confirmedAt: 0 })).toThrow('confirmedAt');
    });
  });

  describe('retry from failed', () => {
    it('can re-enter preparing from failed (retry)', () => {
      let state: ExecutionState = toPreparing(toIdle());
      state = toFailed(state, 'UNKNOWN', 'something went wrong');
      state = toPreparing(state, 'Retrying...');
      expect(state.status).toBe('preparing');
    });
  });

  describe('toIdle()', () => {
    it('always returns idle regardless of current state', () => {
      expect(toIdle().status).toBe('idle');
    });
  });
});
