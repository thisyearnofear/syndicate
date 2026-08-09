import { NextResponse } from 'next/server';
import { FEATURES } from '@/config';
import {
  type XLayerKeeperPoolState,
  veniceXLayerKeeperAdvisor,
} from '@/services/agents/veniceXLayerKeeper';
import { buildPlanFromKeeperRecommendation } from '@/services/agents/loop/agentLoop';
import { ensureXLayerToolsRegistered, listAgentTools } from '@/services/agents/tools';

function catalog() {
  ensureXLayerToolsRegistered();
  return listAgentTools().map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    requiresHitl: t.requiresHitl,
    requiresReceipt: t.requiresReceipt,
    readOnly: t.readOnly,
  }));
}

export async function GET() {
  return NextResponse.json({
    success: true,
    loop: 'plan → HITL approve → execute → observe',
    tools: catalog(),
    veniceConfigured: veniceXLayerKeeperAdvisor.isConfigured(),
    veniceFeatureEnabled: FEATURES.enableVeniceAdvisor,
  });
}

export async function POST(request: Request) {
  try {
    ensureXLayerToolsRegistered();
    const body = (await request.json()) as {
      poolState?: Partial<XLayerKeeperPoolState>;
    };
    const state = normalizePoolState(body.poolState ?? {});
    const recommendation = await veniceXLayerKeeperAdvisor.recommend(state);
    const plan = buildPlanFromKeeperRecommendation(
      recommendation,
      {
        potBalanceUsdc: state.potBalanceUsdc,
        totalShares: state.totalShares,
        epochId: state.epochId,
        drawOpen: state.drawOpen,
        surchargeBps: state.surchargeBps,
      },
      state.epochId,
    );

    return NextResponse.json({
      success: true,
      recommendation,
      plan,
      tools: catalog(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to build agent plan.',
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
    hookOwnerMatchesWallet: Boolean(body.hookOwnerMatchesWallet),
    writesEnabled: body.writesEnabled !== false,
  };
}
