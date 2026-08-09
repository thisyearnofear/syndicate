import {
  buildHeuristicRecommendation,
  sanitizeRecommendation,
  type XLayerKeeperPoolState,
} from '@/services/agents/veniceXLayerKeeper';

const baseState = (): XLayerKeeperPoolState => ({
  potBalanceUsdc: 5,
  totalShares: 100,
  minPotForDrawUsdc: 1,
  drawCooldownSeconds: 0,
  secondsSinceLastDraw: 60,
  surchargeBps: 100,
  surchargeEnabled: true,
  drawOpen: false,
  drawResolved: false,
  drawClaimed: false,
  drawCancelled: false,
  epochId: 0,
  connectedIsWinner: false,
  oracleOwnerMatchesWallet: true,
});

describe('veniceXLayerKeeper', () => {
  it('recommends open_draw when pot, cooldown, and shares allow it', () => {
    const rec = buildHeuristicRecommendation(baseState());
    expect(rec.action).toBe('open_draw');
    expect(rec.shouldOpenDraw).toBe(true);
    expect(rec.surchargeChangeAllowedNow).toBe(false);
    expect(rec.source).toBe('heuristic');
  });

  it('recommends wait when pot is too small', () => {
    const rec = buildHeuristicRecommendation({
      ...baseState(),
      potBalanceUsdc: 0.1,
      minPotForDrawUsdc: 1,
    });
    expect(rec.action).toBe('wait');
    expect(rec.shouldOpenDraw).toBe(false);
  });

  it('recommends set_oracle when draw is open and wallet owns the demo oracle', () => {
    const rec = buildHeuristicRecommendation({
      ...baseState(),
      drawOpen: true,
      epochId: 1,
      oracleOwnerMatchesWallet: true,
    });
    expect(rec.action).toBe('set_oracle');
    expect(rec.demoOracleValue).toBeTruthy();
    expect(BigInt(rec.demoOracleValue!)).toBeGreaterThan(0n);
  });

  it('recommends fulfill_randomness when draw is open but wallet is not oracle owner', () => {
    const rec = buildHeuristicRecommendation({
      ...baseState(),
      drawOpen: true,
      epochId: 1,
      oracleOwnerMatchesWallet: false,
    });
    expect(rec.action).toBe('fulfill_randomness');
  });

  it('sanitizes out-of-range surcharge and unknown actions', () => {
    const rec = sanitizeRecommendation(
      {
        action: 'hack' as never,
        recommendedSurchargeBps: 9999,
        demoOracleValue: '0',
        rationale: ['ok'],
        warnings: [],
      },
      {
        ...baseState(),
        drawOpen: true,
        epochId: 2,
        oracleOwnerMatchesWallet: true,
      },
      'venice',
    );
    expect(rec.action).toBe('set_oracle');
    expect(rec.recommendedSurchargeBps).toBeLessThanOrEqual(500);
    expect(rec.source).toBe('venice');
    expect(rec.demoOracleValue).toBeTruthy();
  });
});
