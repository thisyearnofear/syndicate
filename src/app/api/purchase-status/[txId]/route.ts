import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const STATUS_FILE_PATH = path.join(process.cwd(), 'scripts', 'purchase-status.json');

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
    const purchaseStatus = statuses[txId];

    if (purchaseStatus) {
      return NextResponse.json(purchaseStatus);
    } else {
      // If not found, it might just not be processed yet.
      // Return a pending status instead of a 404 to make client-side logic simpler.
      return NextResponse.json({ status: 'broadcasting', stacksTxId: txId });
    }
  } catch (error) {
    // If the file doesn't exist or there's a parsing error, assume pending.
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return NextResponse.json({ status: 'broadcasting', stacksTxId: txId });
    }
    console.error(`Error reading status for txId ${txId}:`, error);
    return NextResponse.json({ error: 'Failed to retrieve purchase status' }, { status: 500 });
  }
}
