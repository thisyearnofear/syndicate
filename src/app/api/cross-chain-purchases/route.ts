import { NextResponse, NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// IMPORTANT: In a production environment, use a proper database.
const DB_PATH = path.join(process.cwd(), 'scripts', 'cross-chain-purchases.json');

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

        let purchases: CrossChainPurchase[] = [];
        try {
            const data = await fs.readFile(DB_PATH, 'utf-8');
            purchases = JSON.parse(data);
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                // File doesn't exist, return empty array
                return NextResponse.json([]);
            }
            throw error;
        }

        if (stacksAddress) {
            const userPurchases = purchases.filter(p => p.stacksAddress === stacksAddress);
            return NextResponse.json(userPurchases);
        }

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

    let purchases: CrossChainPurchase[] = [];
    try {
      const data = await fs.readFile(DB_PATH, 'utf-8');
      purchases = JSON.parse(data);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        throw error;
      }
    }

    purchases.push(newPurchase);

    await fs.writeFile(DB_PATH, JSON.stringify(purchases, null, 2));

    return NextResponse.json({ success: true, purchase: newPurchase });

  } catch (error) {
    console.error('Failed to record cross-chain purchase:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}