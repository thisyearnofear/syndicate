import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const STATUS_FILE_PATH = path.join(process.cwd(), 'scripts', 'purchase-status.json');

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
    const data = await fs.readFile(STATUS_FILE_PATH, 'utf-8');
    const statuses = JSON.parse(data);
    const normalizedId = txId.startsWith('0x') ? txId.substring(2) : txId;
    
    console.log(`[purchase-status] Looking up txId: ${txId}`);
    console.log(`[purchase-status] Normalized ID: ${normalizedId}`);
    console.log(`[purchase-status] Available keys: ${Object.keys(statuses).join(', ')}`);
    
    const purchaseStatus = statuses[txId] || statuses[normalizedId] || statuses['0x' + normalizedId];
    console.log(`[purchase-status] Found status: ${purchaseStatus ? 'YES' : 'NO'}`);

    if (purchaseStatus) {
      // ENHANCEMENT: Enrich status with receipt links
      return NextResponse.json({
        ...purchaseStatus,
        receipt: {
          stacksExplorer: `https://explorer.stacks.co/txid/${purchaseStatus.stacksTxId}?chain=mainnet`,
          baseExplorer: purchaseStatus.baseTxId ? `https://basescan.org/tx/${purchaseStatus.baseTxId}` : null,
          megapotApp: purchaseStatus.recipientBaseAddress ? `https://megapot.io/?address=${purchaseStatus.recipientBaseAddress}` : null,
        }
      });
    } else {
      // If not found, it might just not be processed yet.
      // Return a pending status instead of a 404 to make client-side logic simpler.
      return NextResponse.json({
        status: 'broadcasting',
        stacksTxId: txId,
        receipt: {
          stacksExplorer: `https://explorer.stacks.co/txid/${txId}?chain=mainnet`,
          baseExplorer: null,
          megapotApp: null,
        }
      });
    }
  } catch (error) {
    // If the file doesn't exist or there's a parsing error, assume pending.
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return NextResponse.json({
        status: 'broadcasting',
        stacksTxId: txId,
        receipt: {
          stacksExplorer: `https://explorer.stacks.co/txid/${txId}?chain=mainnet`,
          baseExplorer: null,
          megapotApp: null,
        }
      });
    }
    console.error(`Error reading status for txId ${txId}:`, error);
    return NextResponse.json({ error: 'Failed to retrieve purchase status' }, { status: 500 });
  }
}
