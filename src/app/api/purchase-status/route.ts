import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseStatusByTxId, upsertPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const txId = searchParams.get('txId');

  if (!txId) {
    return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
  }

  try {
    const purchaseStatus = await getPurchaseStatusByTxId(txId);

    if (purchaseStatus) {
      return NextResponse.json({
        status: purchaseStatus.status,
        sourceChain: purchaseStatus.sourceChain,
        sourceTxId: purchaseStatus.sourceTxId,
        stacksTxId: purchaseStatus.stacksTxId || null,
        baseTxId: purchaseStatus.baseTxId || null,
        error: purchaseStatus.error || null,
        purchaseId: purchaseStatus.purchaseId || null,
        bridgeId: purchaseStatus.bridgeId || null,
        recipientBaseAddress: purchaseStatus.recipientBaseAddress || null,
        updatedAt: purchaseStatus.updatedAt || null,
        receipt: {
          stacksExplorer: purchaseStatus.stacksTxId ? `https://explorer.stacks.co/txid/${purchaseStatus.stacksTxId}?chain=mainnet` : undefined,
          baseExplorer: purchaseStatus.baseTxId ? `https://basescan.org/tx/${purchaseStatus.baseTxId}` : null,
          megapotApp: purchaseStatus.recipientBaseAddress ? `https://megapot.io/?address=${purchaseStatus.recipientBaseAddress}` : null,
        }
      });
    }

    return NextResponse.json({
      status: 'broadcasting',
      stacksTxId: txId,
      receipt: {
        stacksExplorer: `https://explorer.stacks.co/txid/${txId}?chain=mainnet`,
        baseExplorer: undefined,
        megapotApp: null,
      }
    });
  } catch (error) {
    console.error(`Error reading status for txId ${txId}:`, error);
    return NextResponse.json({ error: 'Failed to retrieve purchase status' }, { status: 500 });
  }
}

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
