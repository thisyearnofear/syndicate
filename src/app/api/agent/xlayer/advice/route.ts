import { NextResponse } from 'next/server';
import { FEATURES } from '@/config';
import {
  type XLayerKeeperPoolState,
  veniceXLayerKeeperAdvisor,
} from '@/services/agents/veniceXLayerKeeper';

export async function GET() {
  return NextResponse.json({
    success: true,
    advisor: 'venice-xlayer-keeper',
    enabled: FEATURES.enableVeniceAdvisor,
    configured: veniceXLayerKeeperAdvisor.isConfigured(),
    heuristicFallback: true,
    requiredEnv: ['VENICE_API_KEY'],
    optionalEnv: ['VENICE_MODEL'],
    notes: [
      'Recommendations always available (heuristic if Venice is unset).',
      'openDraw / fulfillRandomness are permissionless; setNextValue is oracle-owner only.',
      'Surcharge advice is advisory after pool bind (timelock).',
    ],
  });
}

export async function POST(request: Request) {
  // Advice stays available even when the Venice feature flag is off — heuristic
  // keeps the Build X AI Season keeper surface demoable. Venice is used when configured.
  try {
    const body = (await request.json()) as Partial<XLayerKeeperPoolState>;
    const state = normalizePoolState(body);
    const recommendation = await veniceXLayerKeeperAdvisor.recommend(state);
    return NextResponse.json({
      success: true,
      recommendation,
      veniceConfigured: veniceXLayerKeeperAdvisor.isConfigured(),
      veniceFeatureEnabled: FEATURES.enableVeniceAdvisor,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to generate X Layer keeper advice.',
      },
      { status: 502 },
    );
  }
}

function normalizePoolState(body: Partial<XLayerKeeperPoolState>): XLayerKeeperPoolState {
  const num = (value: unknown, fallback = 0) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    potBalanceUsdc: Math.max(0, num(body.potBalanceUsdc)),
    totalShares: Math.max(0, num(body.totalShares)),
    minPotForDrawUsdc: Math.max(0, num(body.minPotForDrawUsdc)),
    drawCooldownSeconds: Math.max(0, num(body.drawCooldownSeconds)),
    secondsSinceLastDraw:
      body.secondsSinceLastDraw === null || body.secondsSinceLastDraw === undefined
        ? null
        : Math.max(0, num(body.secondsSinceLastDraw)),
    surchargeBps: Math.max(0, Math.min(10_000, Math.round(num(body.surchargeBps, 100)))),
    surchargeEnabled: Boolean(body.surchargeEnabled ?? true),
    drawOpen: Boolean(body.drawOpen),
    drawResolved: Boolean(body.drawResolved),
    drawClaimed: Boolean(body.drawClaimed),
    drawCancelled: Boolean(body.drawCancelled),
    epochId: Math.max(0, Math.floor(num(body.epochId))),
    connectedIsWinner: Boolean(body.connectedIsWinner),
    oracleOwnerMatchesWallet: Boolean(body.oracleOwnerMatchesWallet),
  };
}
