import { NextRequest, NextResponse } from 'next/server';
import { upsertPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';
import { nearIntentsService } from '@/services/nearIntentsService';

const DEBRIDGE_STATS_API = 'https://stats-api.dln.trade/api/Orders';

async function checkDeBridgeOrder(orderId: string) {
  const res = await fetch(`${DEBRIDGE_STATS_API}/${orderId}`, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`deBridge stats error: ${res.status} ${text}`);
  }
  return res.json() as Promise<{
    state: string;
    fulfillTx?: { txHash?: string };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const contentType = request.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await request.json()
      : Object.fromEntries(await request.formData());

    if (adminSecret) {
      const tokenParam = (body?.token as string | undefined) || undefined;
      if (token !== adminSecret && tokenParam !== adminSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const sourceTxId = body?.sourceTxId as string | undefined;
    const sourceChain = body?.sourceChain as string | undefined;
    const bridgeId = body?.bridgeId as string | undefined;

    if (!sourceTxId || !sourceChain) {
      return NextResponse.json({ error: 'Missing sourceTxId or sourceChain' }, { status: 400 });
    }

    if (sourceChain === 'solana' && bridgeId) {
      const status = await checkDeBridgeOrder(bridgeId);
      if (status.state === 'Fulfilled' || status.state === 'ClaimedUnlock') {
        await upsertPurchaseStatus({
          sourceTxId,
          sourceChain: 'solana',
          status: 'complete',
          baseTxId: status.fulfillTx?.txHash || null,
          bridgeId,
        });
        return NextResponse.json({ success: true, state: status.state });
      }
      return NextResponse.json({ success: true, state: status.state });
    }

    if (sourceChain === 'near' && bridgeId) {
      const status = await nearIntentsService.getIntentStatus(bridgeId);
      if (status.status === 'completed') {
        await upsertPurchaseStatus({
          sourceTxId,
          sourceChain: 'near',
          status: 'complete',
          baseTxId: status.destinationTx || null,
          bridgeId,
        });
      } else if (status.status === 'failed') {
        await upsertPurchaseStatus({
          sourceTxId,
          sourceChain: 'near',
          status: 'error',
          bridgeId,
          error: status.error || 'Intent failed',
        });
      }
      return NextResponse.json({ success: true, state: status.status });
    }

    return NextResponse.json({ success: true, state: 'noop' });
  } catch (error) {
    console.error('[admin/recheck-bridge] Failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
