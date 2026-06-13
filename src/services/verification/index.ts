/**
 * VERIFICATION GATE — FACTORY & PURE GATE LOGIC
 *
 * Selects the verification provider based on the `VERIFICATION_PROVIDER`
 * env var and exposes a pure `evaluateGate` function for both the React
 * hook and tests.
 *
 * Env contract:
 *   - VERIFICATION_PROVIDER=...   (default: 'noop')
 *       'noop'   -> NoopVerificationProvider (always allows, no SDK)
 *       'civic'  -> CivicVerificationProvider (requires CIVIC_GATEWAY_KEY)
 *
 *   - CIVIC_GATEWAY_KEY=...      (required when VERIFICATION_PROVIDER=civic)
 *   - CIVIC_CLIENT_ID=...         (optional)
 *
 * The factory caches the provider instance for the lifetime of the
 * process. Tests should `__resetVerificationProviderForTests()` between
 * cases that change the env.
 */

import { CivicVerificationProvider } from './civicProvider';
import { NoopVerificationProvider } from './noopProvider';
import {
  type GateEvaluation,
  type VerificationContext,
  type VerificationProvider,
  type VerificationRequirement,
  type VerificationStatus,
  VerificationConfigError,
  tierMeets,
} from './types';

export { NoopVerificationProvider, CivicVerificationProvider };
export * from './types';

/** Default provider name when env is unset or empty. */
const DEFAULT_PROVIDER = 'noop';

/** Cached provider instance. */
let cachedProvider: VerificationProvider | null = null;

/** Read the configured provider name from the env. */
function getProviderName(): string {
  const fromEnv = (typeof process !== 'undefined' && process.env?.VERIFICATION_PROVIDER) || '';
  return fromEnv.trim().toLowerCase() || DEFAULT_PROVIDER;
}

/**
 * Get (or build) the active verification provider. The instance is
 * cached for the lifetime of the process.
 */
export function getVerificationProvider(): VerificationProvider {
  if (cachedProvider) return cachedProvider;

  const name = getProviderName();
  switch (name) {
    case 'noop':
      cachedProvider = new NoopVerificationProvider();
      return cachedProvider;
    case 'civic':
      cachedProvider = new CivicVerificationProvider({
        gatewayKey: process.env.CIVIC_GATEWAY_KEY,
        clientId: process.env.CIVIC_CLIENT_ID,
      });
      return cachedProvider;
    default:
      throw new VerificationConfigError(
        `Unknown VERIFICATION_PROVIDER: "${name}". Expected "noop" or "civic".`,
      );
  }
}

/**
 * Test-only: clear the cached provider so a new env takes effect.
 * Do not call this from production code.
 */
export function __resetVerificationProviderForTests(): void {
  cachedProvider = null;
}

/**
 * Pure gate evaluation: combine the user's status with the action's
 * requirement to produce a single `GateEvaluation`.
 *
 * Rules:
 * - If the provider says no requirement, the user is allowed.
 * - If the user has cleared the required tier, the user is allowed.
 * - Otherwise, the user is blocked and the reason is the requirement's.
 */
export function evaluateGate(
  status: VerificationStatus,
  requirement: VerificationRequirement | null,
): GateEvaluation {
  if (requirement === null) {
    return { allowed: true, requirement: null, status };
  }
  if (status.verified && tierMeets(status.tier, requirement.tier)) {
    return { allowed: true, requirement, status };
  }
  return {
    allowed: false,
    requirement,
    status,
    reason: status.verified
      ? `Current tier "${status.tier}" does not meet required tier "${requirement.tier}". ${requirement.reason}`
      : `Verification required. ${requirement.reason}`,
  };
}

/**
 * High-level helper: get the active provider's status + requirement for
 * a context, then evaluate the gate.
 */
export async function checkVerificationGate(
  address: string,
  context: VerificationContext,
): Promise<GateEvaluation> {
  const provider = getVerificationProvider();
  const status = await provider.getStatus(address);
  const requirement = provider.getRequirement(context);
  return evaluateGate(status, requirement);
}
