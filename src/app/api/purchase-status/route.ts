import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseStatusByTxId, upsertPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';
import { getOkxRailPurchaseChainId } from '@/config/okxRail';
import { CHAIN_IDS } from '@/config/index';
import { logger } from '@/lib/logger';

/** Rail ids are server-claimed; the public POST must never write them. */
function isRailOwnedTxId(txId: unknown): txId is string {
  return typeof txId === 'string' && txId.startsWith('okx-');
}

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
      const isXlayer = purchaseStatus.sourceChain === 'xlayer';
      const baseExplorerOrigin =
        isXlayer && getOkxRailPurchaseChainId() === CHAIN_IDS.BASE_SEPOLIA
          ? 'https://sepolia.basescan.org'
          : 'https://basescan.org';
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
        // xlayer rows: bridge_id carries the X Layer payment settlement tx.
        ...(isXlayer ? { paymentSettled: !!purchaseStatus.bridgeId } : {}),
        receipt: {
          stacksExplorer: purchaseStatus.stacksTxId && !isXlayer ? `https://explorer.stacks.co/txid/${purchaseStatus.stacksTxId}?chain=mainnet` : undefined,
          sourceExplorer: isXlayer && purchaseStatus.bridgeId
            ? `https://www.oklink.com/x-layer/tx/${purchaseStatus.bridgeId}`
            : undefined,
          baseExplorer: purchaseStatus.baseTxId ? `${baseExplorerOrigin}/tx/${purchaseStatus.baseTxId}` : null,
          megapotApp: purchaseStatus.recipientBaseAddress ? `https://megapot.io/?address=${purchaseStatus.recipientBaseAddress}` : null,
        }
      });
    }

    // Rail ids are minted server-side; an unknown one is simply absent, not
    // a Stacks-style "broadcasting" purchase.
    if (isRailOwnedTxId(txId)) {
      return NextResponse.json({ status: 'not_found', txId });
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
    logger.error('Error reading purchase status', { txId, error: String(error) });
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

    // Rail rows are written by the server-side settlement pipeline only —
    // an unauthenticated upsert could fabricate a "complete" receipt.
    if (sourceChain === 'xlayer' || isRailOwnedTxId(sourceTxId)) {
      return NextResponse.json(
        { error: 'xlayer rail rows are server-managed' },
        { status: 403 },
      );
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
    logger.error('Failed to upsert purchase status', { error: String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
