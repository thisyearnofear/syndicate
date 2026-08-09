/**
 * Venice X Layer keeper advisor.
 *
 * Reuses the same Venice Chat Completions path as the yield-autopilot policy advisor,
 * but returns draw/surcharge keeper guidance for the Prize Pool Hook.
 *
 * Caps (enforced in sanitize, not left to the model):
 *   - surchargeBps ∈ [0, 500] (0–5%); advisory only once the pool is bound (timelock)
 *   - demoOracleValue must be > 0 when action needs the testnet oracle
 *   - never recommends spending principal or mainnet draws with the demo oracle
 *
 * When VENICE_API_KEY is missing, falls back to a deterministic heuristic so the
 * /xlayer demo still shows an AI-shaped keeper loop.
 */

export type XLayerKeeperAction =
  | 'wait'
  | 'deposit'
  | 'fund_pot'
  | 'open_draw'
  | 'set_oracle'
  | 'fulfill_randomness'
  | 'claim_prize';

export interface XLayerKeeperPoolState {
  potBalanceUsdc: number;
  totalShares: number;
  minPotForDrawUsdc: number;
  drawCooldownSeconds: number;
  secondsSinceLastDraw: number | null;
  surchargeBps: number;
  surchargeEnabled: boolean;
  drawOpen: boolean;
  drawResolved: boolean;
  drawClaimed: boolean;
  drawCancelled: boolean;
  epochId: number;
  connectedIsWinner?: boolean;
  oracleOwnerMatchesWallet?: boolean;
  /** Connected wallet is PrizePoolHook owner (fundPot). */
  hookOwnerMatchesWallet?: boolean;
  /** Writes capability enabled for deposit / fundPot. */
  writesEnabled?: boolean;
}

export interface XLayerKeeperRecommendation {
  action: XLayerKeeperAction;
  shouldOpenDraw: boolean;
  recommendedSurchargeBps: number;
  surchargeChangeAllowedNow: false;
  demoOracleValue: string | null;
  /** Human-readable USDC amount for deposit / fund_pot. */
  amountUsdc: string | null;
  rationale: string[];
  warnings: string[];
  source: 'venice' | 'heuristic';
}

interface VeniceChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const VENICE_CHAT_COMPLETIONS_URL = 'https://api.venice.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'grok-4-3';
const MAX_SURCHARGE_BPS = 500;

class VeniceXLayerKeeperAdvisor {
  isConfigured(): boolean {
    return Boolean(process.env.VENICE_API_KEY);
  }

  async recommend(state: XLayerKeeperPoolState): Promise<XLayerKeeperRecommendation> {
    const heuristic = buildHeuristicRecommendation(state);
    if (!this.isConfigured()) {
      return heuristic;
    }

    try {
      const response = await fetch(VENICE_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.VENICE_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.VENICE_MODEL ?? DEFAULT_MODEL,
          temperature: 0.2,
          max_completion_tokens: 700,
          venice_parameters: {
            enable_web_search: 'off',
            enable_web_scraping: false,
            enable_web_citations: false,
            strip_thinking_response: true,
            disable_thinking: true,
          },
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'xlayer_keeper_recommendation',
              schema: {
                type: 'object',
                required: [
                  'action',
                  'shouldOpenDraw',
                  'recommendedSurchargeBps',
                  'demoOracleValue',
                  'amountUsdc',
                  'rationale',
                  'warnings',
                ],
                properties: {
                  action: {
                    type: 'string',
                    enum: [
                      'wait',
                      'deposit',
                      'fund_pot',
                      'open_draw',
                      'set_oracle',
                      'fulfill_randomness',
                      'claim_prize',
                    ],
                  },
                  shouldOpenDraw: { type: 'boolean' },
                  recommendedSurchargeBps: { type: 'number' },
                  demoOracleValue: { type: ['string', 'null'] },
                  amountUsdc: { type: ['string', 'null'] },
                  rationale: { type: 'array', items: { type: 'string' } },
                  warnings: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
          messages: [
            {
              role: 'system',
              content: [
                'You are the Syndicate X Layer prize-pool keeper advisor.',
                'Recommend the next keeper action for a Uniswap v4 hook lottery on X Layer testnet.',
                'deposit adds lossless shares; fundPot is owner-only seeding when the pot is empty.',
                'openDraw and fulfillRandomness are permissionless; setNextValue on the demo oracle is owner-only.',
                'Surcharge changes require a two-day timelock after the pool is bound — never claim they can apply immediately.',
                'The SimpleRandomnessOracle is testnet-demo only and not provably fair.',
                'Do not promise prizes. Return only JSON matching the schema.',
              ].join(' '),
            },
            {
              role: 'user',
              content: JSON.stringify({
                poolState: state,
                heuristicHint: heuristic,
                outputRules: {
                  action: 'Prefer the heuristic action unless state clearly requires wait.',
                  recommendedSurchargeBps: `Integer 0–${MAX_SURCHARGE_BPS}. Advisory only.`,
                  demoOracleValue: 'Non-zero decimal string when action is set_oracle or fulfill_randomness; otherwise null.',
                  amountUsdc: 'Human USDC amount string for deposit or fund_pot (≤100); otherwise null.',
                },
              }),
            },
          ],
        }),
      });

      if (!response.ok) {
        return { ...heuristic, warnings: [...heuristic.warnings, `Venice HTTP ${response.status}; used heuristic.`] };
      }

      const body = (await response.json()) as VeniceChatResponse;
      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        return { ...heuristic, warnings: [...heuristic.warnings, 'Venice returned empty content; used heuristic.'] };
      }

      return sanitizeRecommendation(
        JSON.parse(content) as Partial<XLayerKeeperRecommendation>,
        state,
        'venice',
      );
    } catch {
      return { ...heuristic, warnings: [...heuristic.warnings, 'Venice unavailable; used heuristic.'] };
    }
  }
}

export const veniceXLayerKeeperAdvisor = new VeniceXLayerKeeperAdvisor();

const DEMO_DEPOSIT_USDC = '5';
const DEMO_AMOUNT_CAP = 100;

/** Exported for unit tests. */
export function buildHeuristicRecommendation(state: XLayerKeeperPoolState): XLayerKeeperRecommendation {
  const cooldownOk =
    state.secondsSinceLastDraw === null ||
    state.secondsSinceLastDraw >= state.drawCooldownSeconds;
  const potOk = state.potBalanceUsdc >= state.minPotForDrawUsdc;
  const hasEntries = state.totalShares > 0;
  const writesOk = state.writesEnabled !== false;

  let action: XLayerKeeperAction = 'wait';
  let amountUsdc: string | null = null;
  const rationale: string[] = [];
  const warnings: string[] = [
    'SimpleRandomnessOracle is a disclosed testnet demo — not for real-value draws.',
    'Surcharge changes need the post-bind timelock; recommendations are advisory only.',
  ];

  if (state.drawResolved && !state.drawClaimed && state.connectedIsWinner) {
    action = 'claim_prize';
    rationale.push('Draw is resolved and the connected wallet is the winner — claim the pot.');
  } else if (state.drawOpen && !state.drawResolved && !state.drawCancelled) {
    if (state.oracleOwnerMatchesWallet) {
      action = 'set_oracle';
      rationale.push('Draw is open; set the demo oracle value for this epoch, then fulfill.');
    } else {
      action = 'fulfill_randomness';
      rationale.push('Draw is open; fulfill randomness once the operator has set the demo oracle value.');
    }
  } else if (!state.drawOpen && potOk && cooldownOk && hasEntries) {
    action = 'open_draw';
    rationale.push('Pot and cooldown allow opening a draw; snapshot shares and await randomness.');
  } else if (!state.drawOpen && !hasEntries && writesOk) {
    action = 'deposit';
    amountUsdc = DEMO_DEPOSIT_USDC;
    rationale.push(`No shares yet — deposit ${DEMO_DEPOSIT_USDC} USDC principal for lossless draw eligibility.`);
  } else if (!state.drawOpen && !potOk && state.hookOwnerMatchesWallet && writesOk) {
    action = 'fund_pot';
    const need = Math.max(1, state.minPotForDrawUsdc - state.potBalanceUsdc);
    amountUsdc = Math.min(DEMO_AMOUNT_CAP, Math.ceil(need * 100) / 100).toFixed(2);
    rationale.push(
      `Pot ${state.potBalanceUsdc.toFixed(2)} USDC is below min ${state.minPotForDrawUsdc.toFixed(2)} — owner can seed ${amountUsdc} USDC.`,
    );
  } else {
    action = 'wait';
    if (!hasEntries) {
      rationale.push(
        writesOk
          ? 'No depositor shares yet — deposit or join via swap.'
          : 'No depositor shares yet — enable writes or wait for entries.',
      );
    }
    if (!potOk) {
      rationale.push(
        `Pot ${state.potBalanceUsdc.toFixed(2)} USDC is below min ${state.minPotForDrawUsdc.toFixed(2)}.`,
      );
    }
    if (!cooldownOk) rationale.push('Draw cooldown has not elapsed.');
    if (!rationale.length) rationale.push('No keeper action is ready; continue accruing swap surcharges.');
  }

  // Nudge surcharge advice toward 1% when pot is empty, slightly lower when pot is healthy.
  const recommendedSurchargeBps =
    state.potBalanceUsdc < Math.max(1, state.minPotForDrawUsdc)
      ? Math.min(MAX_SURCHARGE_BPS, Math.max(50, state.surchargeBps || 100))
      : Math.min(MAX_SURCHARGE_BPS, Math.max(25, Math.min(state.surchargeBps || 100, 100)));

  const needsOracle = action === 'set_oracle' || action === 'fulfill_randomness';
  // Non-zero demo seed — operator-controlled oracle accepts exactly this value.
  const demoOracleValue = needsOracle
    ? String((BigInt(state.epochId + 1) << 32n) + BigInt(Date.now() % 1_000_000_000) || 1n)
    : null;

  return {
    action,
    shouldOpenDraw: action === 'open_draw',
    recommendedSurchargeBps,
    surchargeChangeAllowedNow: false,
    demoOracleValue,
    amountUsdc,
    rationale: rationale.slice(0, 4),
    warnings: warnings.slice(0, 4),
    source: 'heuristic',
  };
}

export function sanitizeRecommendation(
  recommendation: Partial<XLayerKeeperRecommendation>,
  state: XLayerKeeperPoolState,
  source: 'venice' | 'heuristic',
): XLayerKeeperRecommendation {
  const fallback = buildHeuristicRecommendation(state);
  const allowed: XLayerKeeperAction[] = [
    'wait',
    'deposit',
    'fund_pot',
    'open_draw',
    'set_oracle',
    'fulfill_randomness',
    'claim_prize',
  ];
  const action = allowed.includes(recommendation.action as XLayerKeeperAction)
    ? (recommendation.action as XLayerKeeperAction)
    : fallback.action;

  const parsedBps = Number(recommendation.recommendedSurchargeBps);
  const recommendedSurchargeBps = Number.isFinite(parsedBps)
    ? Math.min(MAX_SURCHARGE_BPS, Math.max(0, Math.round(parsedBps)))
    : fallback.recommendedSurchargeBps;

  let demoOracleValue: string | null = null;
  if (action === 'set_oracle' || action === 'fulfill_randomness') {
    const raw = recommendation.demoOracleValue ?? fallback.demoOracleValue;
    try {
      const asBig = BigInt(String(raw ?? '0'));
      demoOracleValue = asBig > 0n ? asBig.toString() : fallback.demoOracleValue;
    } catch {
      demoOracleValue = fallback.demoOracleValue;
    }
  }

  let amountUsdc: string | null = null;
  if (action === 'deposit' || action === 'fund_pot') {
    const raw = recommendation.amountUsdc ?? fallback.amountUsdc ?? DEMO_DEPOSIT_USDC;
    const n = Number.parseFloat(String(raw));
    amountUsdc = Number.isFinite(n) && n > 0
      ? Math.min(DEMO_AMOUNT_CAP, n).toFixed(2)
      : fallback.amountUsdc;
  }

  return {
    action,
    shouldOpenDraw: action === 'open_draw',
    recommendedSurchargeBps,
    surchargeChangeAllowedNow: false,
    demoOracleValue,
    amountUsdc,
    rationale: normalizeStringList(recommendation.rationale, fallback.rationale),
    warnings: normalizeStringList(recommendation.warnings, fallback.warnings),
    source,
  };
}

function normalizeStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  return items.length > 0 ? items : fallback;
}
