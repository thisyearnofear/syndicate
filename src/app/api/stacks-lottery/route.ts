import { NextRequest, NextResponse } from 'next/server';

const STACKS_API_BASE_URL = process.env.NEXT_PUBLIC_STACKS_API_URL || 'https://api.stacks.co/v2';
const STACKS_API_KEY = process.env.NEXT_PUBLIC_STACKS_API_KEY;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint');

        if (!endpoint) {
            return NextResponse.json(
                { error: 'Missing endpoint parameter' },
                { status: 400 }
            );
        }

        // Validate endpoint to prevent SSRF attacks (similar to megapot route)
        const allowedEndpoints = [
            '/lottery/jackpot-round-stats/active',
            '/lottery/ticket-purchases',
            '/lottery/daily-giveaway-winners',
            '/address/', // For wallet balance queries
            '/bridge/sbtc-to-base',
        ];

        const isValidEndpoint = allowedEndpoints.some(allowed =>
            endpoint.startsWith(allowed)
        );

        if (!isValidEndpoint) {
            return NextResponse.json(
                { error: 'Invalid endpoint' },
                { status: 400 }
            );
        }

        const url = `${STACKS_API_BASE_URL}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Add API key to headers if available
        if (STACKS_API_KEY) {
            headers['apikey'] = STACKS_API_KEY;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Stacks API error: ${response.status} - ${errorText}`);

            return NextResponse.json(
                {
                    error: `Stacks API error: ${response.status}`,
                    details: errorText
                },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Add CORS headers to allow frontend access
        return NextResponse.json(data, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    } catch (error) {
        console.error('Stacks proxy error:', error);

        // Handle timeout errors specifically
        if (error instanceof Error && error.name === 'AbortError') {
            return NextResponse.json(
                {
                    error: 'Request timeout',
                    details: 'The Stacks API request timed out. Please try again.'
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
                        details: 'Unable to connect to Stacks API due to CORS restrictions. This may be a temporary issue.'
                    },
                    { status: 502 }
                );
            }

            // Handle generic fetch errors
            if (error.message.includes('fetch')) {
                return NextResponse.json(
                    {
                        error: 'Network error',
                        details: 'Unable to connect to Stacks API. Please check your connection.'
                    },
                    { status: 502 }
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

// Handle POST requests for bridge operations
export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint');

        if (!endpoint) {
            return NextResponse.json(
                { error: 'Missing endpoint parameter' },
                { status: 400 }
            );
        }

        // Only allow bridge operations for POST
        if (!endpoint.includes('/bridge/')) {
            return NextResponse.json(
                { error: 'POST requests only allowed for bridge operations' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const url = `${STACKS_API_BASE_URL}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (STACKS_API_KEY) {
            headers['apikey'] = STACKS_API_KEY;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Stacks API error: ${response.status} - ${errorText}`);

            return NextResponse.json(
                {
                    error: `Stacks API error: ${response.status}`,
                    details: errorText
                },
                { status: response.status }
            );
        }

        const data = await response.json();

        return NextResponse.json(data, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    } catch (error) {
        console.error('Stacks POST proxy error:', error);

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
    return NextResponse.json(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}