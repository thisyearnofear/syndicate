import { NextRequest, NextResponse } from 'next/server';
import { getPendingPurchaseStatusesByChain, upsertPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';
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

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get('authorization') || '';
      const token = auth.replace('Bearer ', '');
      if (token !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const pending = await getPendingPurchaseStatusesByChain('solana');

    let updated = 0;
    for (const record of pending) {
      if (!record.bridgeId) continue;
      try {
        const status = await checkDeBridgeOrder(record.bridgeId);
        if (status.state === 'Fulfilled' || status.state === 'ClaimedUnlock') {
          await upsertPurchaseStatus({
            sourceTxId: record.sourceTxId,
            sourceChain: 'solana',
            status: 'complete',
            baseTxId: status.fulfillTx?.txHash || record.baseTxId || null,
            bridgeId: record.bridgeId,
            recipientBaseAddress: record.recipientBaseAddress || null,
          });
          updated++;
        } else if (
          status.state === 'Cancelled' ||
          status.state === 'OrderCancelled' ||
          status.state === 'ClaimedOrderCancel'
        ) {
          await upsertPurchaseStatus({
            sourceTxId: record.sourceTxId,
            sourceChain: 'solana',
            status: 'error',
            bridgeId: record.bridgeId,
            error: `Bridge order ${status.state}`,
            recipientBaseAddress: record.recipientBaseAddress || null,
          });
          updated++;
        }
      } catch (e) {
        console.warn('[recheck-bridges] Failed to check order', record.bridgeId, e);
      }
    }

    const pendingNear = await getPendingPurchaseStatusesByChain('near');
    for (const record of pendingNear) {
      if (!record.bridgeId) continue;
      try {
        const status = await nearIntentsService.getIntentStatus(record.bridgeId);
        if (status.status === 'completed') {
          await upsertPurchaseStatus({
            sourceTxId: record.sourceTxId,
            sourceChain: 'near',
            status: 'complete',
            baseTxId: status.destinationTx || record.baseTxId || null,
            bridgeId: record.bridgeId,
            recipientBaseAddress: record.recipientBaseAddress || null,
          });
          updated++;
        } else if (status.status === 'failed') {
          await upsertPurchaseStatus({
            sourceTxId: record.sourceTxId,
            sourceChain: 'near',
            status: 'error',
            bridgeId: record.bridgeId,
            error: status.error || 'Intent failed',
            recipientBaseAddress: record.recipientBaseAddress || null,
          });
          updated++;
        }
      } catch (e) {
        console.warn('[recheck-bridges] Failed to check NEAR intent', record.bridgeId, e);
      }
    }

    return NextResponse.json({ success: true, checked: pending.length + pendingNear.length, updated });
  } catch (error) {
    console.error('[recheck-bridges] Failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
