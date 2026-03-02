import { NextRequest, NextResponse } from 'next/server';
import { upsertPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sourceTxId,
      sourceChain,
      status,
      baseTxId,
      recipientBaseAddress,
      bridgeId,
      error,
    } = body || {};

    if (!sourceTxId || !sourceChain || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await upsertPurchaseStatus({
      sourceTxId,
      sourceChain,
      status,
      baseTxId,
      recipientBaseAddress,
      bridgeId,
      error,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to upsert purchase status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
