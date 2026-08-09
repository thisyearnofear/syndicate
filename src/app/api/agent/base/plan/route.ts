import { NextResponse } from 'next/server';
import { FEATURES } from '@/config';
import { venicePolicyAdvisor } from '@/services/agents/venicePolicyAdvisor';
import { resolveAutopilotAdvice } from '@/services/agents/resolveAutopilotAdvice';
import { buildPlanFromBaseYieldContext } from '@/services/agents/loop/baseAgentPlan';
import { ensureBaseToolsRegistered, listAgentTools } from '@/services/agents/tools';

function catalog() {
  ensureBaseToolsRegistered();
  return listAgentTools()
    .filter((t) => t.id.startsWith('base.'))
    .map((t) => ({
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
    loop: 'plan → observe (advisory; MetaMask remains the write boundary)',
    tools: catalog(),
    veniceConfigured: venicePolicyAdvisor.isConfigured(),
    veniceFeatureEnabled: FEATURES.enableVeniceAdvisor,
  });
}

export async function POST(request: Request) {
  try {
    ensureBaseToolsRegistered();
    const body = (await request.json()) as {
      yieldUsdc?: number;
      maxSpendUsdc?: number;
      ticketCount?: number;
      sourceVault?: string;
      policyId?: string | null;
      period?: 'weekly' | 'monthly' | 'opportunistic';
      includeAdvice?: boolean;
      currentAmount?: number;
      currentFrequency?: 'weekly' | 'monthly' | 'opportunistic';
      riskPreference?: 'conservative' | 'balanced' | 'active';
      wantsPrivacy?: boolean;
      walletType?: string | null;
      preservePrincipal?: boolean;
    };

    const yieldUsdc = Math.max(0, Number(body.yieldUsdc) || 0);
    const maxSpendUsdc = Math.max(0, Number(body.maxSpendUsdc) || 0);
    const ticketCount = Math.max(0, Math.floor(Number(body.ticketCount) || 0));
    const sourceVault = String(body.sourceVault || 'spark');
    const includeAdvice = body.includeAdvice !== false;

    let advice = null;
    let adviceSource: 'venice' | 'heuristic' | null = null;
    if (includeAdvice) {
      const resolved = await resolveAutopilotAdvice({
        currentAmount: Number(body.currentAmount ?? maxSpendUsdc) || 5,
        currentFrequency: body.currentFrequency ?? body.period ?? 'weekly',
        currentSourceVault: (body.sourceVault || 'spark') as 'spark' | 'fhenix' | 'pooltogether',
        walletType: body.walletType,
        riskPreference: body.riskPreference ?? 'balanced',
        wantsPrivacy: body.wantsPrivacy ?? sourceVault === 'fhenix',
        preservePrincipal: body.preservePrincipal ?? true,
      });
      advice = resolved.recommendation;
      adviceSource = resolved.source;
    }

    const plan = buildPlanFromBaseYieldContext({
      yieldUsdc,
      maxSpendUsdc,
      ticketCount,
      sourceVault,
      policyId: body.policyId,
      period: body.period,
      advice,
    });

    return NextResponse.json({
      success: true,
      advice,
      /** Alias for callers that historically expected `recommendation`. */
      recommendation: advice,
      adviceSource,
      plan,
      tools: catalog(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to build Base agent plan.',
      },
      { status: 502 },
    );
  }
}
