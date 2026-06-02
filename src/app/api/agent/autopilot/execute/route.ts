import { NextResponse } from 'next/server';
import {
  type YieldAutopilotExecutionPlan,
  yieldAutopilotAgent,
} from '@/services/agents/yieldAutopilotAgent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = body?.plan as YieldAutopilotExecutionPlan | undefined;

    if (!plan?.policyId || !plan.permissionId || !plan.from || !plan.to || !plan.data) {
      return NextResponse.json({ success: false, error: 'Invalid autopilot execution plan' }, { status: 400 });
    }

    const result = await yieldAutopilotAgent.executePreparedPlan(plan);
    const status = result.success || result.status === 'client-signature-required' ? 200 : 400;

    return NextResponse.json({ success: result.success, result }, { status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to execute autopilot plan' },
      { status: 500 }
    );
  }
}

