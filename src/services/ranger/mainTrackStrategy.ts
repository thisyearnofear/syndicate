export type RangerStrategyStatus =
  | 'candidate'
  | 'needs_validation'
  | 'buildable'
  | 'rejected';

export interface RangerEligibilityRule {
  id: string;
  summary: string;
}

export interface RangerRiskGuardrail {
  id: string;
  limit: string;
  rationale: string;
}

export interface RangerStrategyCandidate {
  id: string;
  name: string;
  status: RangerStrategyStatus;
  isPrimary?: boolean;
  thesis: string;
  returnDrivers: string[];
  venues: string[];
  risks: string[];
  reasons: string[];
  guardrails: RangerRiskGuardrail[];
}

export const rangerMainTrackRules: RangerEligibilityRule[] = [
  {
    id: 'min-apy',
    summary: 'Target at least 10% APY with a 3-month rolling tenor.',
  },
  {
    id: 'no-ponzi-like-yield',
    summary: 'Avoid circular or reflexive yield-bearing stablecoin dependencies.',
  },
  {
    id: 'no-junior-tranches',
    summary: 'Avoid junior tranche or insurance-pool style principal-loss structures.',
  },
  {
    id: 'no-dex-lp-vaults',
    summary: 'Do not use DEX LP vaults such as JLP, HLP, or LLP as the core yield source.',
  },
  {
    id: 'no-high-leverage-looping',
    summary: 'Avoid high-leverage looping and keep health metrics comfortably above hard danger zones.',
  },
];

export const rangerMainTrackCandidates: RangerStrategyCandidate[] = [
  {
    id: 'solana-usdc-carry',
    name: 'Solana USDC Carry Allocator',
    status: 'buildable',
    isPrimary: true,
    thesis:
      'Allocate USDC across transparent Solana carry venues and keep the strategy understandable, monitorable, and on-chain verifiable.',
    returnDrivers: [
      'Base lending yield from supported USDC venues',
      'Tactical allocation toward higher carry pockets when risk stays inside policy',
    ],
    venues: ['Kamino Lend', 'Jupiter Lend', 'Ranger-managed Solana vault'],
    risks: [
      'Yield may compress below the main-track minimum APY target',
      'Opportunity cost if the portfolio remains too conservative',
    ],
    reasons: [
      'Best fit for truthful documentation and straightforward on-chain verification',
      'Can be surfaced in Syndicate without pretending the app itself is the strategy',
    ],
    guardrails: [
      {
        id: 'single-venue-cap',
        limit: 'Max 50% NAV in a single venue',
        rationale: 'Reduce venue-specific smart contract and liquidity concentration.',
      },
      {
        id: 'rebalance-band',
        limit: 'Rebalance when venue spread exceeds policy threshold or utilization changes materially',
        rationale: 'Maintain target allocation discipline instead of ad hoc moves.',
      },
      {
        id: 'stable-asset-only',
        limit: 'Base asset remains USDC throughout the default allocation path',
        rationale: 'Keep the primary vault leg simple and auditable.',
      },
    ],
  },
  {
    id: 'delta-neutral-basis',
    name: 'Conservative Delta-Neutral Basis',
    status: 'needs_validation',
    thesis:
      'Use USDC collateral for tightly bounded carry capture with explicit leverage ceilings and deterministic rebalance rules.',
    returnDrivers: [
      'Funding or basis capture on liquid markets',
      'Supplementary conservative venue yield on idle capital',
    ],
    venues: ['Ranger-managed Solana vault', 'Drift-integrated execution path'],
    risks: [
      'More operational complexity',
      'Needs careful eligibility confirmation against the published disallowed-yield list',
      'Requires stronger monitoring than a lending-only allocator',
    ],
    reasons: [
      'More plausible path to clear the 10% APY target',
      'Closer to the strategy depth judges appear to expect',
    ],
    guardrails: [
      {
        id: 'gross-exposure-cap',
        limit: 'Cap gross exposure and avoid high-leverage looping structures',
        rationale: 'Stay clearly outside the published disqualifying leverage profile.',
      },
      {
        id: 'health-buffer',
        limit: 'Maintain a wide health buffer above any protocol liquidation boundary',
        rationale: 'The submission needs a conservative and defensible risk story.',
      },
      {
        id: 'kill-switch',
        limit: 'De-risk to cash allocation when volatility, utilization, or funding regime breaks policy',
        rationale: 'A strategy without a shutdown path is not submission-ready.',
      },
    ],
  },
  {
    id: 'drift-jlp-lossless-lottery',
    name: 'Drift JLP Lossless Lottery',
    status: 'rejected',
    thesis:
      'Route JLP yield into lottery tickets while preserving principal.',
    returnDrivers: ['DEX LP and associated yield streams'],
    venues: ['Drift JLP', 'Syndicate yield-to-tickets flow'],
    risks: ['Fails the published main-track disallow list for DEX LP vaults.'],
    reasons: [
      'Useful product idea, but not a safe main-track strategy thesis.',
    ],
    guardrails: [],
  },
];

export const PRIMARY_RANGER_STRATEGY_ID = 'solana-usdc-carry';

export function getRangerStrategyCandidate(
  id: string
): RangerStrategyCandidate | undefined {
  return rangerMainTrackCandidates.find((candidate) => candidate.id === id);
}

export function getPrimaryRangerStrategy(): RangerStrategyCandidate | undefined {
  return getRangerStrategyCandidate(PRIMARY_RANGER_STRATEGY_ID);
}

export function getBuildableRangerStrategies(): RangerStrategyCandidate[] {
  return rangerMainTrackCandidates.filter(
    (candidate) => candidate.status === 'buildable'
  );
}
