import { NextResponse } from 'next/server';
import { yieldAutopilotAgent } from '@/services/agents/yieldAutopilotAgent';
import type { PermissionedAutopilotPolicy } from '@/services/metamask/delegationTypes';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const policy = body?.policy as PermissionedAutopilotPolicy | undefined;

    if (!policy?.id || !policy.permissionId || !policy.targetContract || !policy.maxSpendPerPeriod) {
      return NextResponse.json({ success: false, error: 'Invalid autopilot policy' }, { status: 400 });
    }

    const activity = await yieldAutopilotAgent.planPolicy(policy);
    return NextResponse.json({ success: true, activity });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to prepare autopilot execution' },
      { status: 500 }
    );
  }
}

