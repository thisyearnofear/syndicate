import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import path from 'path';

const MEGAPOT_API_BASE_URL = 'https://api.megapot.io/api/v1';
const MEGAPOT_API_KEY = process.env.NEXT_PUBLIC_MEGAPOT_API_KEY;
const CROSS_CHAIN_DB_PATH = path.join(process.cwd(), 'scripts', 'cross-chain-purchases.json');

// Helper to fetch purchases for a single EVM address
async function fetchPurchasesForEvmAddress(walletAddress: string) {
    const endpoint = `/ticket-purchases/${walletAddress}`;
    const url = `${MEGAPOT_API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (MEGAPOT_API_KEY) headers['apikey'] = MEGAPOT_API_KEY;

    const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(30000) });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Megapot API error for ${walletAddress}: ${response.status} - ${errorText}`);
        // Return empty array for a single address failure to not fail the whole batch
        return [];
    }
    return response.json();
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');
        const chain = searchParams.get('chain');

        if (!walletAddress) {
            return NextResponse.json({ error: 'Missing wallet address parameter' }, { status: 400 });
        }

        let evmAddressesToQuery: string[] = [];

        if (chain === 'stacks') {
            // Stacks flow: Find associated EVM addresses from our cross-chain DB
            const isStacksAddress = /^S[P|M][0-9A-Z]{38,39}$/.test(walletAddress);
            if (!isStacksAddress) {
                return NextResponse.json({ error: 'Invalid Stacks wallet address format' }, { status: 400 });
            }
            try {
                const data = await fs.readFile(CROSS_CHAIN_DB_PATH, 'utf-8');
                const purchases: { stacksAddress: string; evmAddress: string; }[] = JSON.parse(data);
                const associatedEvmAddrs = purchases
                    .filter(p => p.stacksAddress === walletAddress)
                    .map(p => p.evmAddress);
                evmAddressesToQuery = [...new Set(associatedEvmAddrs)]; // Deduplicate
            } catch (error) {
                // DB file might not exist or be empty
                return NextResponse.json([]);
            }
        } else {
            // Default flow: Assume the provided address is an EVM address
            const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
            if (!isEvmAddress) {
                return NextResponse.json({ error: 'Invalid EVM wallet address format' }, { status: 400 });
            }
            evmAddressesToQuery.push(walletAddress);
        }

        if (evmAddressesToQuery.length === 0) {
            return NextResponse.json([]);
        }

        // Fetch purchases for all relevant EVM addresses in parallel
        const allPurchases = await Promise.all(
            evmAddressesToQuery.map(addr => fetchPurchasesForEvmAddress(addr))
        );
        const combinedData = allPurchases.flat();

        // --- The rest of the logic is for data enrichment (timestamps, etc.) ---
        
        const baseRpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
        const provider = new ethers.JsonRpcProvider(baseRpcUrl);
        const globalCache = global as { __txTimestampCache?: Map<string, string> };
        const txTimestampCache: Map<string, string> = globalCache.__txTimestampCache || new Map();
        globalCache.__txTimestampCache = txTimestampCache;

        const resolveTimestamp = async (txHash?: string): Promise<string | null> => {
            if (!txHash) return null;
            const cached = txTimestampCache.get(txHash);
            if (cached) return cached;
            try {
                const receipt = await provider.getTransactionReceipt(txHash);
                if (!receipt || !receipt.blockNumber) return null;
                const block = await provider.getBlock(receipt.blockNumber);
                if (!block || !block.timestamp) return null;
                const ts = new Date(block.timestamp * 1000).toISOString();
                txTimestampCache.set(txHash, ts);
                return ts;
            } catch (e) {
                console.warn('Failed to resolve timestamp for tx', txHash, e);
                return null;
            }
        };

        interface MegapotPurchase {
            startTicket?: number; endTicket?: number; ticketsPurchased?: number;
            transactionHashes?: string[]; txHash?: string; timestamp?: string | number;
            createdAt?: string | number; updatedAt?: string | number; jackpotRoundId: number;
            recipient: string; referrer?: string; buyer: string;
        }

        const transformedData = await Promise.all(combinedData.map(async (purchase: MegapotPurchase) => {
            const rangeCount = typeof purchase.startTicket === 'number' && typeof purchase.endTicket === 'number' ? Math.max(0, purchase.endTicket - purchase.startTicket + 1) : 0;
            const ticketCount = typeof purchase.ticketsPurchased === 'number' && purchase.ticketsPurchased > 0 ? purchase.ticketsPurchased : rangeCount;
            const totalCost = ticketCount.toString();
            const txHash = purchase.transactionHashes?.[0] || purchase.txHash || '';
            const apiTs = purchase.timestamp || purchase.createdAt || purchase.updatedAt || null;
            const timestamp = apiTs ? new Date(apiTs).toISOString() : await resolveTimestamp(txHash);

            return {
                id: txHash || `${purchase.jackpotRoundId}-${purchase.recipient}`,
                ticketCount, totalCost, txHash, timestamp: timestamp || null, status: 'active',
                jackpotRoundId: purchase.jackpotRoundId, startTicket: purchase.startTicket,
                endTicket: purchase.endTicket, referrer: purchase.referrer, buyer: purchase.buyer,
            };
        }));

        return NextResponse.json(transformedData, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-C ontrol-Allow-Headers': 'Content-Type, Authorization',
            },
        });

    } catch (error) {
        console.error('Proxy error:', error);
        if (error instanceof Error && error.name === 'AbortError') {
            return NextResponse.json({ error: 'Request timeout', details: 'The Megapot API request timed out.' }, { status: 504 });
        }
        return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
