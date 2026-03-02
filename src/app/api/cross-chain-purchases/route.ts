import { NextResponse, NextRequest } from 'next/server';
import {
    getAllCrossChainPurchases,
    getCrossChainPurchasesByStacksAddress,
    insertCrossChainPurchase,
} from '@/lib/db/repositories/crossChainPurchaseRepository';

interface CrossChainPurchase {
    sourceChain: 'stacks';
    stacksAddress: string;
    evmAddress: string;
    stacksTxId: string;
    baseTxId: string;
    ticketCount: number;
    purchaseTimestamp: string;
}

// Read all purchases or find by Stacks address
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const stacksAddress = searchParams.get('stacksAddress');

        if (stacksAddress) {
            const userPurchases = await getCrossChainPurchasesByStacksAddress(stacksAddress);
            return NextResponse.json(userPurchases);
        }

        const purchases = await getAllCrossChainPurchases();
        return NextResponse.json(purchases);

    } catch (error) {
        console.error('Failed to read cross-chain purchases:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


// Write a new purchase record
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { stacksAddress, evmAddress, stacksTxId, baseTxId, ticketCount } = body;
    if (!stacksAddress || !evmAddress || !stacksTxId || !baseTxId || !ticketCount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newPurchase: CrossChainPurchase = {
      sourceChain: 'stacks',
      stacksAddress,
      evmAddress,
      stacksTxId,
      baseTxId,
      ticketCount,
      purchaseTimestamp: new Date().toISOString(),
    };

    await insertCrossChainPurchase(newPurchase);

    return NextResponse.json({ success: true, purchase: newPurchase });

  } catch (error) {
    console.error('Failed to record cross-chain purchase:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
