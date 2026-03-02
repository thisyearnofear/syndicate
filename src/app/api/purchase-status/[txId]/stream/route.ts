import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';

export async function GET(
  request: NextRequest,
  { params }: { params: { txId: string } }
) {
  try {
    const { txId } = params;
    
    if (!txId) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    const status = await getPurchaseStatus(txId);

    if (!status) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    // Calculate progress percentage
    const statusProgress: Record<string, number> = {
      pending: 10,
      bridging: 40,
      purchasing: 70,
      complete: 100,
      error: 0,
    };

    const progress = statusProgress[status.status] || 0;

    // Estimate time remaining
    const estimatedTimes: Record<string, number> = {
      stacks: 600, // 10 minutes
      near: 180,   // 3 minutes
      solana: 120, // 2 minutes
    };

    const totalTime = estimatedTimes[status.sourceChain] || 300;
    const elapsed = status.updatedAt ? Date.now() - new Date(status.updatedAt).getTime() : 0;
    const remaining = Math.max(0, totalTime - Math.floor(elapsed / 1000));

    return NextResponse.json({
      ...status,
      progress,
      estimatedSecondsRemaining: remaining,
      steps: [
        { name: 'Transaction Signed', status: 'complete', timestamp: status.createdAt },
        { name: 'Bridging to Base', status: progress >= 40 ? 'complete' : progress > 10 ? 'in_progress' : 'pending', timestamp: status.status === 'bridging' ? status.updatedAt : null },
        { name: 'Purchasing Tickets', status: progress >= 70 ? 'complete' : progress > 40 ? 'in_progress' : 'pending', timestamp: status.status === 'purchasing' ? status.updatedAt : null },
        { name: 'Complete', status: progress === 100 ? 'complete' : 'pending', timestamp: status.status === 'complete' ? status.updatedAt : null },
      ],
    });
  } catch (error) {
    console.error('Error fetching purchase status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
