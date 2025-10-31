import { NextRequest, NextResponse } from 'next/server';

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

        // Validate wallet address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return NextResponse.json(
                { error: 'Invalid wallet address format' },
                { status: 400 }
            );
        }

        const endpoint = `/ticket-purchases?recipient=${walletAddress}`;
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

        // Transform the data to match our frontend interface
        const transformedData = data.map((purchase: any) => ({
            id: purchase.transactionHashes?.[0] || `${purchase.jackpotRoundId}-${purchase.recipient}`,
            ticketCount: purchase.ticketsPurchased || 0,
            totalCost: (purchase.ticketsPurchased || 0).toString(),
            txHash: purchase.transactionHashes?.[0] || '',
            timestamp: new Date().toISOString(), // API doesn't provide timestamp, use current time
            status: 'active', // Default status, would need additional logic to determine actual status
            jackpotRoundId: purchase.jackpotRoundId,
            startTicket: purchase.startTicket,
            endTicket: purchase.endTicket,
            referrer: purchase.referrer,
            buyer: purchase.buyer,
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