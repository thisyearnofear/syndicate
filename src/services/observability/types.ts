/**
 * LIFECYCLE OBSERVABILITY — Event Types
 *
 * Typed event definitions for money-moving and automation operations.
 * Events are structured so they can be routed to:
 *   - Application logger (structured JSON)
 *   - Analytics pipeline
 *   - Real-time monitoring / alerting
 *   - User-facing activity feed (filtered)
 *
 * Rules:
 *   - Never include private keys, permit signatures, or plaintext private balances.
 *   - Include chain, provider, operation type, sanitized error category,
 *     and transaction/transfer identifiers.
 *   - Errors include category + phase, not raw stack traces.
 */

// ─── Event categories ─────────────────────────────────────────────────────────

export type EventCategory =
  | 'purchase'
  | 'bridge'
  | 'vault'
  | 'automation'
  | 'execution'
  | 'verification'
  | 'agent';

// ─── Event names ──────────────────────────────────────────────────────────────

export type LifecycleEventName =
  // Purchase lifecycle
  | 'purchase.initiated'
  | 'purchase.signature_requested'
  | 'purchase.submitted'
  | 'purchase.confirmed'
  | 'purchase.failed'
  // Bridge lifecycle
  | 'bridge.started'
  | 'bridge.source_confirmed'
  | 'bridge.attestation_received'
  | 'bridge.confirmed'
  | 'bridge.failed'
  // Vault lifecycle
  | 'vault.deposit_initiated'
  | 'vault.deposit_confirmed'
  | 'vault.withdraw_initiated'
  | 'vault.withdraw_confirmed'
  | 'vault.operation_failed'
  // Automation lifecycle
  | 'automation.task_created'
  | 'automation.task_updated'
  | 'automation.task_cancelled'
  | 'automation.task_executed'
  | 'automation.execution_failed'
  // Execution state machine
  | 'execution.state_changed'
  // Verification
  | 'verification.gate_evaluated'
  | 'verification.gate_blocked'
  // Agent loop (HITL tooling — every transition is an auditable event)
  | 'agent.plan_created'
  | 'agent.plan_failed'
  | 'agent.session_reset'
  | 'agent.step_approved'
  | 'agent.step_rejected'
  | 'agent.step_executed'
  | 'agent.step_completed'
  | 'agent.step_failed';

// ─── Base event structure ─────────────────────────────────────────────────────

export interface LifecycleEvent<T extends LifecycleEventName = LifecycleEventName> {
  /** Event name (dot-separated category.action). */
  name: T;
  /** Category for routing/filtering. */
  category: EventCategory;
  /** ISO timestamp. */
  timestamp: string;
  /** Chain where the operation executes (null for chain-agnostic events). */
  chain: string | null;
  /** Chain ID (numeric, null for non-EVM or chain-agnostic). */
  chainId: number | null;
  /** Operation type (purchase, deposit, withdraw, bridge, etc.). */
  operation: string | null;
  /** Provider or protocol involved (aave, cctp, megapot, etc.). */
  provider: string | null;
  /** Transaction hash (source chain, if applicable). Never a private key. */
  transactionHash: string | null;
  /** Transfer/bridge ID (e.g., CCTP attestation hash). */
  transferId: string | null;
  /** Sanitized user address (first 10 chars + ellipsis). */
  userAddressPrefix: string | null;
  /** Structured error info (only for failure events). */
  error: EventError | null;
  /** Additional typed metadata. */
  metadata: Record<string, string | number | boolean | null>;
}

export interface EventError {
  /** Machine-readable error code/category. */
  code: string;
  /** Human-readable summary (no stack traces, no secrets). */
  message: string;
  /** Phase during which the error occurred. */
  phase: string;
  /** Whether the user explicitly rejected/cancelled. */
  userCancelled: boolean;
}

// ─── Event builder options ────────────────────────────────────────────────────

export interface EmitOptions {
  chain?: string;
  chainId?: number;
  operation?: string;
  provider?: string;
  transactionHash?: string;
  transferId?: string;
  userAddress?: string;
  error?: EventError;
  metadata?: Record<string, string | number | boolean | null>;
}
