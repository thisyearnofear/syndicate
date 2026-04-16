/**
 * TIERED KYC THRESHOLDS
 * 
 * Aligned with FATF Travel Rule guidance (Recommendation 16) and
 * institutional DeFi best practices.
 *
 * Below $1,000: frictionless (anti-bot only)
 * $1,000–$10,000: Liveness check (biometric selfie, no document upload)
 * Above $10,000: Full ID Verification (document + liveness + sanctions screening)
 */

export type KycTier = 'captcha' | 'liveness' | 'id_verification';

export interface KycTierInfo {
  tier: KycTier;
  label: string;
  description: string;
  minAmount: number;
}

const KYC_TIERS: KycTierInfo[] = [
  {
    tier: 'id_verification',
    label: 'Full ID Verification',
    description: 'Document + liveness + sanctions screening per Travel Rule requirements.',
    minAmount: 10_000,
  },
  {
    tier: 'liveness',
    label: 'Liveness Verification',
    description: 'Biometric selfie check to prevent spoofing. No document upload needed.',
    minAmount: 1_000,
  },
  {
    tier: 'captcha',
    label: 'Anti-Bot Check',
    description: 'Quick CAPTCHA verification — no personal data required.',
    minAmount: 0,
  },
];

/**
 * Returns the required KYC tier for a given deposit amount (in USDC).
 */
export function getRequiredKycTier(depositAmount: number): KycTierInfo {
  return KYC_TIERS.find(t => depositAmount >= t.minAmount) ?? KYC_TIERS[KYC_TIERS.length - 1];
}

/**
 * Formats a human-readable compliance rationale for the UI.
 */
export function getComplianceRationale(amountUsdc: number): string {
  if (amountUsdc >= 10_000) {
    return 'Deposits ≥ $10,000 require full identity verification under the Travel Rule (FATF Recommendation 16).';
  }
  if (amountUsdc >= 1_000) {
    return 'Deposits ≥ $1,000 require liveness verification to meet anti-sybil and basic compliance standards.';
  }
  return 'Deposits under $1,000 only require a quick anti-bot check.';
}
