import type { VaultProtocol } from '@/services/vaults';

export type VeniceRiskPreference = 'conservative' | 'balanced' | 'active';

export interface VenicePolicyAdvisorInput {
  currentAmount: number;
  currentFrequency: 'weekly' | 'monthly' | 'opportunistic';
  currentSourceVault: VaultProtocol;
  walletType?: string | null;
  riskPreference?: VeniceRiskPreference;
  wantsPrivacy?: boolean;
  preservePrincipal?: boolean;
}

export interface VenicePolicyRecommendation {
  sourceVault: VaultProtocol;
  mode: 'yield-autopilot';
  period: 'weekly' | 'monthly';
  maxSpendUsdc: string;
  ticketCount: number;
  preservePrincipal: true;
  relayer: '1shot';
  rationale: string[];
  warnings: string[];
}

interface VeniceChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const VENICE_CHAT_COMPLETIONS_URL = 'https://api.venice.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'zai-org-glm-5-1';
const ALLOWED_VAULTS = new Set<VaultProtocol>(['spark', 'fhenix', 'pooltogether']);

class VenicePolicyAdvisor {
  isConfigured(): boolean {
    return Boolean(process.env.VENICE_API_KEY);
  }

  async recommend(input: VenicePolicyAdvisorInput): Promise<VenicePolicyRecommendation> {
    if (!this.isConfigured()) {
      throw new Error('Venice advisor is not configured. Set VENICE_API_KEY before requesting policy advice.');
    }

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
            type: 'object',
            required: [
              'sourceVault',
              'mode',
              'period',
              'maxSpendUsdc',
              'ticketCount',
              'preservePrincipal',
              'relayer',
              'rationale',
              'warnings',
            ],
            properties: {
              sourceVault: { type: 'string', enum: ['spark', 'fhenix', 'pooltogether'] },
              mode: { type: 'string', enum: ['yield-autopilot'] },
              period: { type: 'string', enum: ['weekly', 'monthly'] },
              maxSpendUsdc: { type: 'string' },
              ticketCount: { type: 'number' },
              preservePrincipal: { type: 'boolean' },
              relayer: { type: 'string', enum: ['1shot'] },
              rationale: { type: 'array', items: { type: 'string' } },
              warnings: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        messages: [
          {
            role: 'system',
            content: [
              'You are Syndicate policy advisor.',
              'Recommend a conservative permission policy for yield-funded lottery participation.',
              'Do not promise profits or prizes.',
              'Do not recommend spending principal.',
              'Do not recommend transaction execution.',
              'Return only valid JSON matching the schema.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              appContext: {
                product: 'Syndicate',
                allowedVaults: ['spark', 'fhenix', 'pooltogether'],
                allowedMode: 'yield-autopilot',
                allowedRelayer: '1shot',
                ticketPriceUsdcAssumption: 1,
                megapotCaveat: 'Megapot is the underlying lottery protocol and has its own native recurring purchase contracts.',
                poolTogetherCaveat: 'PoolTogether is the underlying no-loss prize savings protocol.',
              },
              userIntent: input,
              outputRules: {
                maxSpendUsdc: 'Between 1 and 25. Use the existing amount as an upper bound unless active risk is selected.',
                ticketCount: 'Integer between 1 and maxSpendUsdc rounded down.',
                preservePrincipal: 'Always true.',
                warnings: 'Mention lottery risk, revocable permissions, and underlying protocol caveat.',
              },
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Venice advisor HTTP ${response.status}`);
    }

    const body = await response.json() as VeniceChatResponse;
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Venice advisor returned no recommendation.');
    }

    return sanitizeRecommendation(JSON.parse(content) as Partial<VenicePolicyRecommendation>, input);
  }
}

export const venicePolicyAdvisor = new VenicePolicyAdvisor();

function sanitizeRecommendation(
  recommendation: Partial<VenicePolicyRecommendation>,
  input: VenicePolicyAdvisorInput
): VenicePolicyRecommendation {
  const sourceVault = ALLOWED_VAULTS.has(recommendation.sourceVault as VaultProtocol)
    ? recommendation.sourceVault as VaultProtocol
    : input.wantsPrivacy
      ? 'fhenix'
      : input.currentSourceVault;
  const period = recommendation.period === 'monthly' ? 'monthly' : 'weekly';
  const parsedSpend = Number.parseFloat(recommendation.maxSpendUsdc ?? '');
  const spendCap = input.riskPreference === 'active' ? 25 : Math.max(1, input.currentAmount || 1);
  const maxSpend = Math.min(Math.max(Number.isFinite(parsedSpend) ? parsedSpend : input.currentAmount, 1), spendCap);
  const ticketCount = Math.min(
    Math.max(1, Math.floor(Number(recommendation.ticketCount) || maxSpend)),
    Math.floor(maxSpend)
  );

  return {
    sourceVault,
    mode: 'yield-autopilot',
    period,
    maxSpendUsdc: maxSpend.toFixed(2),
    ticketCount,
    preservePrincipal: true,
    relayer: '1shot',
    rationale: normalizeStringList(recommendation.rationale, [
      'Use accrued yield only, preserving principal.',
      'Keep automation bounded by a revocable MetaMask permission.',
      'Use 1Shot relay only after the user approves the policy.',
    ]),
    warnings: normalizeStringList(recommendation.warnings, [
      'Lottery participation does not guarantee prizes.',
      'Megapot and PoolTogether remain the underlying prize protocols.',
      'Revoke or update the permission if your risk preference changes.',
    ]),
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
