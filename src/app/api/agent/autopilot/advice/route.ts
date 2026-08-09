/**
 * Thin compatibility wrapper — canonical Base advice lives in /api/agent/base/plan.
 * Prefer that endpoint for new callers.
 */

import { NextResponse } from 'next/server';
import { FEATURES } from '@/config';
import {
  type VenicePolicyAdvisorInput,
  venicePolicyAdvisor,
} from '@/services/agents/venicePolicyAdvisor';
import { resolveAutopilotAdvice } from '@/services/agents/resolveAutopilotAdvice';

export async function GET() {
  return NextResponse.json({
    success: true,
    advisor: 'venice',
    canonical: '/api/agent/base/plan',
    enabled: FEATURES.enableVeniceAdvisor,
    configured: venicePolicyAdvisor.isConfigured(),
    requiredEnv: ['VENICE_API_KEY'],
    optionalEnv: ['VENICE_MODEL'],
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VenicePolicyAdvisorInput;
    const { recommendation, source } = await resolveAutopilotAdvice(body);
    return NextResponse.json({
      success: true,
      recommendation,
      source,
      canonical: '/api/agent/base/plan',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to generate policy advice.',
      },
      { status: 502 },
    );
  }
}
