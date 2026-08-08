/**
 * EXECUTION STATE MACHINE — Public API
 *
 * Use this module to manage the lifecycle of any value-moving operation.
 *
 * Consumers:
 *   - useUnifiedPurchase (ticket purchases, cross-chain)
 *   - useVaultDeposit / useYieldWithdrawal
 *   - Future X Layer write flows
 *   - Any service that sends a transaction and awaits confirmation
 *
 * Usage:
 *   import { toIdle, toPreparing, toPendingSignature, toSubmitted, toConfirming, toCompleted, toFailed } from '@/services/execution';
 *   import type { ExecutionState, ConfirmedReceipt } from '@/services/execution';
 */

export type {
  ExecutionState,
  ExecutionPhase,
  ExecutionOperation,
  ExecutionError,
  ExecutionErrorCode,
  ConfirmedReceipt,
  ReceiptEvent,
  IdleState,
  PreparingState,
  PendingSignatureState,
  SubmittedState,
  ConfirmingState,
  BridgingState,
  CompletedState,
  FailedState,
} from './types';

export {
  toIdle,
  toPreparing,
  toPendingSignature,
  toSubmitted,
  toConfirming,
  toBridging,
  toCompleted,
  toFailed,
} from './transitions';

export { useExecution } from './useExecution';
export type { UseExecutionResult } from './useExecution';
