/**
 * useExecution — React hook for the execution state machine.
 *
 * Wraps the pure transition functions in React state, providing:
 *   - Current execution state as a discriminated union
 *   - Transition actions that enforce valid state paths
 *   - Derived convenience booleans (isActive, isTerminal, etc.)
 *   - Automatic reset capability
 *
 * Usage:
 *   const execution = useExecution();
 *   execution.prepare('Simulating transaction...');
 *   execution.awaitSignature('base');
 *   execution.submit(txHash, chainId);
 *   execution.confirm(txHash, chainId);
 *   execution.complete(receipt);
 *   // or: execution.fail('REVERTED', 'Transaction reverted');
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import type {
  ExecutionState,
  ExecutionErrorCode,
  ConfirmedReceipt,
} from './types';
import {
  toIdle,
  toPreparing,
  toPendingSignature,
  toSubmitted,
  toConfirming,
  toBridging,
  toCompleted,
  toFailed,
} from './transitions';

export interface UseExecutionResult {
  /** Current execution state (discriminated union). */
  state: ExecutionState;

  // ─── Derived booleans ─────────────────────────────────────────────────────
  /** True while any non-idle, non-terminal state is active. */
  isActive: boolean;
  /** True when in a terminal state (completed or failed). */
  isTerminal: boolean;
  /** True when the execution completed successfully. */
  isSuccess: boolean;
  /** True when the execution failed. */
  isError: boolean;

  // ─── Transition actions ───────────────────────────────────────────────────
  /** Start preparation (e.g., simulation, balance check). */
  prepare: (detail?: string) => void;
  /** Waiting for wallet signature. */
  awaitSignature: (chain: string) => void;
  /** Transaction submitted to the network. */
  submit: (transactionHash: string, chainId: number) => void;
  /** Transaction is being confirmed on-chain. */
  confirm: (transactionHash: string, chainId: number, confirmations?: number) => void;
  /** Cross-chain bridge in progress. */
  bridge: (sourceTransactionHash: string, sourceChainId: number, targetChainId: number, transferId?: string) => void;
  /** Execution completed with a verified receipt. */
  complete: (receipt: ConfirmedReceipt, sourceReceipt?: ConfirmedReceipt) => void;
  /** Execution failed. */
  fail: (code: ExecutionErrorCode, message: string, opts?: { userCancelled?: boolean; cause?: unknown }) => void;
  /** Reset to idle. */
  reset: () => void;
}

export function useExecution(): UseExecutionResult {
  const [state, setState] = useState<ExecutionState>(toIdle());

  const prepare = useCallback((detail?: string) => {
    setState((s) => toPreparing(s, detail));
  }, []);

  const awaitSignature = useCallback((chain: string) => {
    setState((s) => toPendingSignature(s, chain));
  }, []);

  const submit = useCallback((transactionHash: string, chainId: number) => {
    setState((s) => toSubmitted(s, transactionHash, chainId));
  }, []);

  const confirm = useCallback((transactionHash: string, chainId: number, confirmations?: number) => {
    setState((s) => toConfirming(s, transactionHash, chainId, confirmations));
  }, []);

  const bridge = useCallback((sourceTransactionHash: string, sourceChainId: number, targetChainId: number, transferId?: string) => {
    setState((s) => toBridging(s, sourceTransactionHash, sourceChainId, targetChainId, transferId));
  }, []);

  const complete = useCallback((receipt: ConfirmedReceipt, sourceReceipt?: ConfirmedReceipt) => {
    setState((s) => toCompleted(s, receipt, sourceReceipt));
  }, []);

  const fail = useCallback((code: ExecutionErrorCode, message: string, opts?: { userCancelled?: boolean; cause?: unknown }) => {
    setState((s) => toFailed(s, code, message, opts));
  }, []);

  const reset = useCallback(() => {
    setState(toIdle());
  }, []);

  const derived = useMemo(() => ({
    isActive: state.status !== 'idle' && state.status !== 'completed' && state.status !== 'failed',
    isTerminal: state.status === 'completed' || state.status === 'failed',
    isSuccess: state.status === 'completed',
    isError: state.status === 'failed',
  }), [state.status]);

  return {
    state,
    ...derived,
    prepare,
    awaitSignature,
    submit,
    confirm,
    bridge,
    complete,
    fail,
    reset,
  };
}
