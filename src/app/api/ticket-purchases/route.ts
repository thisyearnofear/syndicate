import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const MEGAPOT_API_BASE_URL = 'https://api.megapot.io/api/v1';
const MEGAPOT_API_KEY = process.env.NEXT_PUBLIC_MEGAPOT_API_KEY;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Missing wallet address parameter' },
                { status: 400 }
            );
        }

        // Validate wallet address format - support both EVM and Solana addresses
        const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
        const isSolanaAddress = /^[1-9A-HJ-NP-Z]{43,44}$/.test(walletAddress); // Solana base58
        
        if (!isEvmAddress && !isSolanaAddress) {
            return NextResponse.json(
                { error: 'Invalid wallet address format - must be EVM (0x...) or Solana address' },
                { status: 400 }
            );
        }

        // Megapot API only supports EVM addresses
        // If a Solana address is provided, return empty list (Solana purchases are tracked separately)
        if (isSolanaAddress) {
            return NextResponse.json([]);
        }

        const endpoint = `/ticket-purchases/${walletAddress}`;
        const url = `${MEGAPOT_API_BASE_URL}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Add API key to headers if available
        if (MEGAPOT_API_KEY) {
            headers['apikey'] = MEGAPOT_API_KEY;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Megapot API error: ${response.status} - ${errorText}`);

            return NextResponse.json(
                {
                    error: `Megapot API error: ${response.status}`,
                    details: errorText
                },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Optional RPC URL for Base; default to public RPC
        const baseRpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
        const provider = new ethers.JsonRpcProvider(baseRpcUrl);

        // Simple in-memory cache for tx timestamps to reduce RPC calls on warm starts
        // Note: Cache persists across requests only while the serverless function stays warm
        const globalCache = global as { __txTimestampCache?: Map<string, string> };
        const txTimestampCache: Map<string, string> = globalCache.__txTimestampCache || new Map();
        globalCache.__txTimestampCache = txTimestampCache;

        // Basescan fallback
        const resolveTimestampViaBaseScan = async (txHash?: string): Promise<string | null> => {
            if (!txHash) return null;
            const apiKey = process.env.BASESCAN_API_KEY;
            if (!apiKey) return null;
            try {
                // Check cache first
                const cached = txTimestampCache.get(txHash);
                if (cached) return cached;

                const baseUrl = 'https://api.basescan.org/api';
                // Get receipt to obtain block number
                const receiptResp = await fetch(`${baseUrl}?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${apiKey}`);
                const receiptJson = await receiptResp.json();
                const blockHex: string | undefined = receiptJson?.result?.blockNumber;
                if (!blockHex) return null;

                // Get block by number to obtain timestamp
                const blockResp = await fetch(`${baseUrl}?module=proxy&action=eth_getBlockByNumber&tag=${blockHex}&boolean=true&apikey=${apiKey}`);
                const blockJson = await blockResp.json();
                const tsHex: string | undefined = blockJson?.result?.timestamp;
                if (!tsHex) return null;
                const tsSeconds = parseInt(tsHex, 16);
                const ts = new Date(tsSeconds * 1000).toISOString();
                txTimestampCache.set(txHash, ts);
                return ts;
            } catch (err) {
                console.warn('Basescan fallback failed for tx', txHash, err);
                return null;
            }
        };

        // Helper to resolve tx timestamp from chain
        const resolveTimestamp = async (txHash?: string): Promise<string | null> => {
            if (!txHash) return null;
            try {
                // Cache hit
                const cached = txTimestampCache.get(txHash);
                if (cached) return cached;

                const receipt = await provider.getTransactionReceipt(txHash);
                if (!receipt || !receipt.blockNumber) return null;
                const block = await provider.getBlock(receipt.blockNumber);
                if (!block || !block.timestamp) return null;
                const ts = new Date(block.timestamp * 1000).toISOString();
                txTimestampCache.set(txHash, ts);
                return ts;
            } catch (e) {
                // Fallback via getTransaction -> blockNumber
                try {
                    const tx = await provider.getTransaction(txHash);
                    const blockNumber = tx?.blockNumber;
                    if (!blockNumber) throw new Error('No blockNumber on tx');
                    const block = await provider.getBlock(blockNumber);
                    if (!block || !block.timestamp) throw new Error('No block timestamp');
                    const ts = new Date(block.timestamp * 1000).toISOString();
                    txTimestampCache.set(txHash, ts);
                    return ts;
                } catch (fallbackErr) {
                    // Final fallback: Basescan proxy API
                    const basescanTs = await resolveTimestampViaBaseScan(txHash);
                    if (basescanTs) return basescanTs;
                    console.warn('Failed to resolve timestamp for tx', txHash, e, fallbackErr);
                    return null;
                }
            }
        };

        // Transform + enrich with timestamps
        interface MegapotPurchase {
            startTicket?: number;
            endTicket?: number;
            ticketsPurchased?: number;
            transactionHashes?: string[];
            txHash?: string;
            timestamp?: string | number;
            createdAt?: string | number;
            updatedAt?: string | number;
            jackpotRoundId: number;
            recipient: string;
            referrer?: string;
            buyer: string;
            // NEW: Cross-chain purchase tracking
            sourceChain?: string;
            sourceWallet?: string;
            bridgeTransactionHash?: string;
        }

        const transformedData = await Promise.all(data.map(async (purchase: MegapotPurchase) => {
            // Compute ticket count: prefer API field, fallback to range
            const rangeCount =
                typeof purchase.startTicket === 'number' && typeof purchase.endTicket === 'number'
                    ? Math.max(0, purchase.endTicket - purchase.startTicket + 1)
                    : 0;
            const ticketCount =
                typeof purchase.ticketsPurchased === 'number' && purchase.ticketsPurchased > 0
                    ? purchase.ticketsPurchased
                    : rangeCount;

            // Each ticket costs 1 USDC per Megapot docs
            const totalCost = ticketCount.toString();

            const txHash = purchase.transactionHashes?.[0] || purchase.txHash || '';
            // Prefer any existing timestamp fields from API if available
            const apiTs = purchase.timestamp || purchase.createdAt || purchase.updatedAt || null;
            const timestamp = apiTs ? new Date(apiTs).toISOString() : await resolveTimestamp(txHash);

            return {
                id: txHash || `${purchase.jackpotRoundId}-${purchase.recipient}`,
                ticketCount,
                totalCost,
                txHash,
                timestamp: timestamp || null,
                status: 'active', // Default status, would need additional logic to determine actual status
                jackpotRoundId: purchase.jackpotRoundId,
                startTicket: purchase.startTicket,
                endTicket: purchase.endTicket,
                referrer: purchase.referrer,
                buyer: purchase.buyer,
            };
        }));

        // Add CORS headers to allow frontend access
        return NextResponse.json(transformedData, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    } catch (error) {
        console.error('Proxy error:', error);

        // Handle timeout errors specifically
        if (error instanceof Error && error.name === 'AbortError') {
            return NextResponse.json(
                {
                    error: 'Request timeout',
                    details: 'The Megapot API request timed out. Please try again.'
                },
                { status: 504 } // Gateway Timeout
            );
        }

        // Handle network errors
        if (error instanceof Error) {
            // Handle CORS issues
            if (error.message.includes('Cross-Origin-Opener-Policy') ||
                error.message.includes('CORS') ||
                error.message.includes('blocked by CORS policy')) {
                return NextResponse.json(
                    {
                        error: 'CORS policy error',
                        details: 'Unable to connect to Megapot API due to CORS restrictions. This may be a temporary issue.'
                    },
                    { status: 502 }
                );
            }

            // Handle generic fetch errors
            if (error.message.includes('fetch')) {
                return NextResponse.json(
                    {
                        error: 'Network error',
                        details: 'Unable to connect to Megapot API. Please check your connection.'
                    },
                    { status: 502 } // Bad Gateway
                );
            }
        }

        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// Handle preflight requests
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
