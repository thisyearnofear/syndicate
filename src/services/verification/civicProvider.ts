/**
 * CIVIC VERIFICATION PROVIDER (STUB)
 *
 * Stub for the Civic integration. The Civic SDK (`@civic/pass` /
 * `@civic/gateway`) is **not** bundled. This provider only becomes
 * active when:
 *   1. `VERIFICATION_PROVIDER=civic` is set
 *   2. The required Civic env vars are configured
 *   3. The Civic SDK package is installed
 *
 * When the SDK is added later, replace the stub `getStatus` body with
 * the Civic call. The interface and factory wiring do not need to change.
 *
 * Tier mapping for Civic (to confirm before integration):
 *   - `captcha`            -> Civic Captcha (anti-bot)
 *   - `liveness`           -> Civic Liveness (biometric selfie)
 *   - `id_verification`    -> Civic ID Verification (KYC)
 */

import { getRequiredKycTier, type KycTier } from '@/utils/kycTiers';
import { VerificationConfigError, type VerificationContext, type VerificationProvider, type VerificationRequirement, type VerificationStatus, type VerificationTier } from './types';

const TIER_MAP: Record<KycTier, VerificationTier> = {
  captcha: 'captcha',
  liveness: 'liveness',
  id_verification: 'id_verification',
};

export class CivicVerificationProvider implements VerificationProvider {
  readonly name = 'civic';

  constructor(private readonly config: { gatewayKey?: string; clientId?: string }) {
    if (!config.gatewayKey) {
      throw new VerificationConfigError(
        'CIVIC_GATEWAY_KEY is required when VERIFICATION_PROVIDER=civic. ' +
        'Bundle @civic/gateway, set CIVIC_GATEWAY_KEY, and instantiate from the factory.',
      );
    }
  }

  isEnabled(): boolean {
    return Boolean(this.config.gatewayKey);
  }

  /**
   * Stub: returns an unverified status. Once the Civic SDK is bundled,
   * this method should call `Civic.getStatus(address)` and map the
   * result into a `VerificationStatus`.
   */
  async getStatus(address: string): Promise<VerificationStatus> {
    return {
      address: address.toLowerCase(),
      tier: 'none',
      verified: false,
      provider: this.name,
      reason: 'Civic SDK not yet bundled. Run `pnpm add @civic/gateway` and complete the stub in civicProvider.ts.',
    };
  }

  getRequirement(context: VerificationContext): VerificationRequirement | null {
    if (context.amount === undefined || context.amount < 1_000) {
      // Below the $1,000 threshold — no requirement.
      return null;
    }
    const tier = TIER_MAP[getRequiredKycTier(context.amount).tier];
    return {
      tier,
      reason: `Deposits ≥ $${getRequiredKycTier(context.amount).minAmount.toLocaleString()} require ${tier} verification.`,
      minAmount: getRequiredKycTier(context.amount).minAmount,
    };
  }
}
