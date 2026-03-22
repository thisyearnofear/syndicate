import { NextRequest, NextResponse } from 'next/server';
import { vaultManager } from '@/services/vaults';

export async function POST(req: NextRequest) {
  try {
    const { protocol, amount, userAddress } = await req.json();

    if (!protocol || !amount || !userAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: protocol, amount, userAddress' },
        { status: 400 },
      );
    }

    const result = await vaultManager.deposit(protocol, amount, userAddress);

    return NextResponse.json({
      success: result.success,
      txData: result.txData,
      txHash: result.txHash,
      vaultId: result.vaultId,
      error: result.error,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Deposit failed';
    console.error('[API /vault/deposit]', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
