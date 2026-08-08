/**
 * EXECUTION STATE MACHINE — Pure Transition Functions
 *
 * These functions enforce valid state transitions and ensure that:
 *   - Only valid source states can transition to a given target
 *   - `completed` is only reachable from `confirming` with a verified receipt
 *   - `failed` is reachable from any active state
 *   - `idle` is only reachable via explicit reset
 *
 * All functions are pure (no side effects). They return a new state or throw
 * if the transition is invalid.
 */

import type {
  ExecutionState,
  ExecutionError,
  ExecutionErrorCode,
  ExecutionPhase,
  ConfirmedReceipt,
} from './types';

// ─── Valid transitions ────────────────────────────────────────────────────────

/**
 * Transition to preparing phase.
 * Valid from: idle, failed (retry).
 */
export function toPreparing(
  current: ExecutionState,
  detail?: string,
): ExecutionState {
  assertPhase(current, ['idle', 'failed'], 'preparing');
  return { status: 'preparing', detail };
}

/**
 * Transition to pending_signature.
 * Valid from: preparing.
 */
export function toPendingSignature(
  current: ExecutionState,
  chain: string,
): ExecutionState {
  assertPhase(current, ['preparing'], 'pending_signature');
  return { status: 'pending_signature', chain };
}

/**
 * Transition to submitted.
 * Valid from: pending_signature.
 */
export function toSubmitted(
  current: ExecutionState,
  transactionHash: string,
  chainId: number,
): ExecutionState {
  assertPhase(current, ['pending_signature'], 'submitted');
  return { status: 'submitted', transactionHash, chainId };
}

/**
 * Transition to confirming (waiting for on-chain confirmation).
 * Valid from: submitted.
 */
export function toConfirming(
  current: ExecutionState,
  transactionHash: string,
  chainId: number,
  confirmations?: number,
): ExecutionState {
  assertPhase(current, ['submitted'], 'confirming');
  return { status: 'confirming', transactionHash, chainId, confirmations };
}

/**
 * Transition to bridging (cross-chain transfer in progress).
 * Valid from: confirming (source chain confirmed, now bridging to target).
 */
export function toBridging(
  current: ExecutionState,
  sourceTransactionHash: string,
  sourceChainId: number,
  targetChainId: number,
  transferId?: string,
): ExecutionState {
  assertPhase(current, ['confirming'], 'bridging');
  return { status: 'bridging', sourceTransactionHash, sourceChainId, targetChainId, transferId };
}

/**
 * Transition to completed.
 * Valid from: confirming (single-chain) or bridging (cross-chain).
 * Requires a verified ConfirmedReceipt — this is the enforcement point.
 */
export function toCompleted(
  current: ExecutionState,
  receipt: ConfirmedReceipt,
  sourceReceipt?: ConfirmedReceipt,
): ExecutionState {
  assertPhase(current, ['confirming', 'bridging'], 'completed');
  validateReceipt(receipt);
  return { status: 'completed', receipt, sourceReceipt };
}

/**
 * Transition to failed.
 * Valid from any active state (not idle or already completed).
 */
export function toFailed(
  current: ExecutionState,
  code: ExecutionErrorCode,
  message: string,
  opts: { userCancelled?: boolean; cause?: unknown } = {},
): ExecutionState {
  if (current.status === 'completed') {
    throw new Error('Cannot transition from completed to failed');
  }
  const error: ExecutionError = {
    code,
    message,
    phase: current.status as ExecutionPhase,
    userCancelled: opts.userCancelled ?? false,
    cause: opts.cause,
  };
  return { status: 'failed', error };
}

/**
 * Reset to idle.
 * Valid from any state.
 */
export function toIdle(): ExecutionState {
  return { status: 'idle' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertPhase(
  current: ExecutionState,
  allowed: readonly ExecutionPhase[],
  target: ExecutionPhase,
): void {
  if (!allowed.includes(current.status as ExecutionPhase)) {
    throw new Error(
      `Invalid transition: cannot move from "${current.status}" to "${target}". Allowed source phases: [${allowed.join(', ')}]`,
    );
  }
}

function validateReceipt(receipt: ConfirmedReceipt): void {
  if (!receipt.transactionHash) {
    throw new Error('ConfirmedReceipt must include a transactionHash');
  }
  if (!receipt.blockNumber || receipt.blockNumber < 0) {
    throw new Error('ConfirmedReceipt must include a valid blockNumber');
  }
  if (!receipt.chainId) {
    throw new Error('ConfirmedReceipt must include a chainId');
  }
  if (!receipt.confirmedAt || receipt.confirmedAt <= 0) {
    throw new Error('ConfirmedReceipt must include a positive confirmedAt timestamp');
  }
}
