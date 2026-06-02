import { NextResponse } from 'next/server';
import { FEATURES } from '@/config';
import {
  type VenicePolicyAdvisorInput,
  venicePolicyAdvisor,
} from '@/services/agents/venicePolicyAdvisor';

export async function GET() {
  return NextResponse.json({
    success: true,
    advisor: 'venice',
    enabled: FEATURES.enableVeniceAdvisor,
    configured: venicePolicyAdvisor.isConfigured(),
    requiredEnv: ['VENICE_API_KEY'],
    optionalEnv: ['VENICE_MODEL'],
  });
}

export async function POST(request: Request) {
  if (!FEATURES.enableVeniceAdvisor) {
    return NextResponse.json(
      { success: false, error: 'Venice advisor is disabled.' },
      { status: 404 }
    );
  }

  if (!venicePolicyAdvisor.isConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Venice advisor is not configured. Set VENICE_API_KEY.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const recommendation = await venicePolicyAdvisor.recommend(body as VenicePolicyAdvisorInput);
    return NextResponse.json({
      success: true,
      recommendation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to generate Venice policy advice.',
      },
      { status: 502 }
    );
  }
}
