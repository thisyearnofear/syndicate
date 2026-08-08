/**
 * EXECUTION STATE MACHINE — Types
 *
 * A strict discriminated union representing the lifecycle of any value-moving
 * operation: purchases, deposits, withdrawals, bridges, and future write flows.
 *
 * Invariant: `completed` is only reachable through a verified on-chain receipt.
 * `pending_signature`, `submitted`, `confirming`, and `bridging` are always
 * treated as incomplete. No money movement should be reported to the user
 * as successful until state === 'completed'.
 */

// ─── Receipt types ────────────────────────────────────────────────────────────

/** A verified on-chain transaction receipt. */
export interface ConfirmedReceipt {
  /** Transaction hash on the settlement chain. */
  transactionHash: string;
  /** Block number the transaction was included in. */
  blockNumber: number;
  /** Chain ID where the receipt was confirmed. */
  chainId: number;
  /** Optional event log data from the receipt (e.g., Transfer events). */
  events?: readonly ReceiptEvent[];
  /** Timestamp of confirmation (unix ms). */
  confirmedAt: number;
}

export interface ReceiptEvent {
  name: string;
  args: Record<string, unknown>;
  address: string;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export interface ExecutionError {
  /** Machine-readable error code. */
  code: ExecutionErrorCode;
  /** Human-readable message. */
  message: string;
  /** The phase during which the error occurred. */
  phase: ExecutionPhase;
  /** Whether the user explicitly cancelled/rejected. */
  userCancelled: boolean;
  /** Underlying error object, if available. */
  cause?: unknown;
}

export type ExecutionErrorCode =
  | 'NOT_CONNECTED'
  | 'UNSUPPORTED_CHAIN'
  | 'INSUFFICIENT_BALANCE'
  | 'USER_REJECTED'
  | 'SIGNING_FAILED'
  | 'SUBMISSION_FAILED'
  | 'CONFIRMATION_TIMEOUT'
  | 'BRIDGE_FAILED'
  | 'REVERTED'
  | 'UNKNOWN';

// ─── Execution phases ─────────────────────────────────────────────────────────

export type ExecutionPhase =
  | 'idle'
  | 'preparing'
  | 'pending_signature'
  | 'submitted'
  | 'confirming'
  | 'bridging'
  | 'completed'
  | 'failed';

// ─── Discriminated union state ────────────────────────────────────────────────

export type ExecutionState =
  | IdleState
  | PreparingState
  | PendingSignatureState
  | SubmittedState
  | ConfirmingState
  | BridgingState
  | CompletedState
  | FailedState;

export interface IdleState {
  status: 'idle';
}

export interface PreparingState {
  status: 'preparing';
  /** Optional description of what is being prepared. */
  detail?: string;
}

export interface PendingSignatureState {
  status: 'pending_signature';
  /** Which wallet/chain is being signed on. */
  chain: string;
}

export interface SubmittedState {
  status: 'submitted';
  /** Source transaction hash (submitted but not yet confirmed). */
  transactionHash: string;
  /** Chain the transaction was submitted to. */
  chainId: number;
}

export interface ConfirmingState {
  status: 'confirming';
  /** Source transaction hash being confirmed. */
  transactionHash: string;
  chainId: number;
  /** Number of confirmations received so far. */
  confirmations?: number;
}

export interface BridgingState {
  status: 'bridging';
  /** Source-chain transaction hash (already confirmed on source). */
  sourceTransactionHash: string;
  sourceChainId: number;
  /** Bridge transfer identifier (e.g., CCTP attestation hash). */
  transferId?: string;
  /** Target chain ID. */
  targetChainId: number;
}

export interface CompletedState {
  status: 'completed';
  /** Verified on-chain receipt — the source of truth for success. */
  receipt: ConfirmedReceipt;
  /** Optional source-chain receipt for cross-chain operations. */
  sourceReceipt?: ConfirmedReceipt;
}

export interface FailedState {
  status: 'failed';
  error: ExecutionError;
}

// ─── Operation metadata ───────────────────────────────────────────────────────

/** Describes the kind of operation being executed. */
export type ExecutionOperation =
  | 'purchase'
  | 'deposit'
  | 'withdraw'
  | 'bridge'
  | 'approve'
  | 'claim'
  | 'xlayer_join'
  | 'xlayer_exit';
