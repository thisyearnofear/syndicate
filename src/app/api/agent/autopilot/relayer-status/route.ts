import { NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { oneShotRelayerService } from '@/services/metamask/oneShotRelayerService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chainId = Number(searchParams.get('chainId') ?? '8453');
  const taskId = searchParams.get('taskId');

  if (taskId) {
    try {
      const status = await oneShotRelayerService.getStatus(taskId as Hex, chainId);
      return NextResponse.json({
        success: true,
        relayer: '1shot',
        status,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          relayer: '1shot',
          error: error instanceof Error ? error.message : 'Unable to fetch 1Shot task status.',
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    relayer: '1shot',
    configured: oneShotRelayerService.isConfigured(chainId),
    endpoint: oneShotRelayerService.getEndpoint(chainId),
    requiredEnv: [],
    optionalEnv: ['ONESHOT_RELAYER_URL'],
    requiredExecutionData: ['permissionContext', 'executions'],
  });
}
