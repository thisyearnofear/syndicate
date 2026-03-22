import { NextRequest, NextResponse } from 'next/server';
import { vaultManager } from '@/services/vaults';

export async function POST(req: NextRequest) {
  try {
    const { protocol, amount, userAddress, yieldOnly } = await req.json();

    if (!protocol || !userAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: protocol, userAddress' },
        { status: 400 },
      );
    }

    let result;
    if (yieldOnly) {
      result = await vaultManager.withdrawYield(protocol, userAddress);
    } else if (amount) {
      result = await vaultManager.withdraw(protocol, amount, userAddress);
    } else {
      return NextResponse.json(
        { success: false, error: 'Either amount or yieldOnly must be provided' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: result.success,
      txData: result.txData,
      txHash: result.txHash,
      amountWithdrawn: result.amountWithdrawn,
      error: result.error,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Withdrawal failed';
    console.error('[API /vault/withdraw]', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
