/**
 * VERIFICATION GATE — TYPES
 *
 * The runtime side of the verification policy. The policy side lives in
 * `src/utils/kycTiers.ts` (which tier is required for which amount).
 * This module defines the runtime interface a provider must implement
 * to actually verify a user.
 *
 * Design goals (see AGENTS.md > Verification Gate (planned)):
 * - Thin internal `VerificationProvider` interface.
 * - `NoopVerificationProvider` is the default and is always on.
 * - `CivicVerificationProvider` is a stub until the Civic SDK is bundled
 *   and the env var is set; instantiation throws if misconfigured.
 * - The provider is selected at module load by `VERIFICATION_PROVIDER`.
 */

/** Verification tiers, in increasing order of rigour. */
export type VerificationTier = 'none' | 'captcha' | 'liveness' | 'id_verification';

/** Ordered tiers for "at least N" comparisons. */
export const TIER_ORDER: readonly VerificationTier[] = [
  'none',
  'captcha',
  'liveness',
  'id_verification',
] as const;

/** Numeric rank of a tier; higher = more rigorous. */
export function tierRank(tier: VerificationTier): number {
  return TIER_ORDER.indexOf(tier);
}

/** True if `actual` is at least as rigorous as `required`. */
export function tierMeets(actual: VerificationTier, required: VerificationTier): boolean {
  return tierRank(actual) >= tierRank(required);
}

/** Snapshot of a user's verification state. */
export interface VerificationStatus {
  /** User's wallet address (lowercased). */
  address: string;
  /** The tier the user has cleared. `none` means no check at all. */
  tier: VerificationTier;
  /** Whether the user has cleared at least the `none` tier. */
  verified: boolean;
  /** Provider that produced this status (e.g. "noop", "civic"). */
  provider: string;
  /** When the verification was issued (epoch ms). */
  issuedAt?: number;
  /** When the verification expires (epoch ms). */
  expiresAt?: number;
  /** Human-readable reason for the current state, for UI display. */
  reason?: string;
}

/** What an action requires from the user. */
export interface VerificationRequirement {
  /** Minimum tier needed. `null` means no verification needed. */
  tier: VerificationTier;
  /** Human-readable explanation. */
  reason: string;
  /** USDC threshold that triggered the requirement (for UI). */
  minAmount?: number;
}

/** Context for evaluating whether an action needs verification. */
export interface VerificationContext {
  /** Action being performed. */
  action: 'deposit' | 'withdraw' | 'bridge' | 'purchase' | 'create_syndicate';
  /** Amount in USDC, if the action is amount-gated. */
  amount?: number;
}

/** Interface every verification provider must implement. */
export interface VerificationProvider {
  /** Provider name (e.g. "noop", "civic"). */
  readonly name: string;

  /** Whether the provider is fully configured and ready. */
  isEnabled(): boolean;

  /** Look up the user's current verification status. */
  getStatus(address: string): Promise<VerificationStatus>;

  /**
   * Determine what tier (if any) the given action requires.
   * Returns `null` if the action needs no verification.
   */
  getRequirement(context: VerificationContext): VerificationRequirement | null;
}

/** Result of evaluating a gate. */
export interface GateEvaluation {
  /** Whether the user is allowed to proceed. */
  allowed: boolean;
  /** What the user would need to do to become allowed (null if `allowed`). */
  reason?: string;
  /** The requirement that was evaluated (null if none). */
  requirement: VerificationRequirement | null;
  /** The user's current status. */
  status: VerificationStatus;
}

/** Thrown when the factory is asked for an unknown provider. */
export class VerificationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerificationConfigError';
  }
}
