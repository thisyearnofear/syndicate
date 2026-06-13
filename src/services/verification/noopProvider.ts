/**
 * NOOP VERIFICATION PROVIDER
 *
 * The default provider. Allows every user at every tier with no
 * verification, no SDK, and no network calls.
 *
 * This is the right default for:
 * - Local development
 * - Pre-launch / Testnet
 * - Any deployment where KYC has not been mandated yet
 *
 * To switch on a real provider, set `VERIFICATION_PROVIDER=civic`
 * (and configure the matching env vars) — the factory will then
 * instantiate the Civic provider instead.
 */

import type {
  VerificationContext,
  VerificationProvider,
  VerificationRequirement,
  VerificationStatus,
} from './types';

export class NoopVerificationProvider implements VerificationProvider {
  readonly name = 'noop';

  isEnabled(): boolean {
    // Always on. The whole point of the noop is to be the safe default.
    return true;
  }

  async getStatus(address: string): Promise<VerificationStatus> {
    return {
      address: address.toLowerCase(),
      tier: 'none',
      verified: true,
      provider: this.name,
      reason: 'No verification required (noop provider active).',
    };
  }

  getRequirement(context: VerificationContext): VerificationRequirement | null {
    // The noop provider never blocks anything. The UI should not show any
    // verification prompt while the noop is active.
    void context;
    return null;
  }
}
