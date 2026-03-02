import { NextRequest, NextResponse } from 'next/server';
import { finalizeStacksPurchase } from '@/services/bridges/finalizers/stacksFinalize';

export async function POST(request: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    if (adminSecret) {
      const auth = request.headers.get('authorization') || '';
      const token = auth.replace('Bearer ', '');
      if (token !== adminSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const stacksTxId = body?.stacksTxId;
    const recipientBaseAddress = body?.recipientBaseAddress;
    if (!stacksTxId || !recipientBaseAddress) {
      return NextResponse.json({ error: 'Missing stacksTxId or recipientBaseAddress' }, { status: 400 });
    }

    const result = await finalizeStacksPurchase(stacksTxId, recipientBaseAddress);
    return NextResponse.json({ success: true, txHash: result.txHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
