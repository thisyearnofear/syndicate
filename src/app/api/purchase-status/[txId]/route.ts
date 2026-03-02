import { NextResponse } from 'next/server';
import { getPurchaseStatusByTxId } from '@/lib/db/repositories/purchaseStatusRepository';

/**
 * ENHANCEMENT: Return receipt data with full provenance
 * DRY: Single source of truth for purchase status + receipts
 */
export async function GET(
  request: Request,
  { params }: { params: { txId: string } }
) {
  const txId = params.txId;

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
        baseExplorer: null,
        megapotApp: null,
      }
    });
  } catch (error) {
    console.error(`Error reading status for txId ${txId}:`, error);
    return NextResponse.json({ error: 'Failed to retrieve purchase status' }, { status: 500 });
  }
}
