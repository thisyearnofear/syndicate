import { NextRequest, NextResponse } from 'next/server';

const MEGAPOT_API_BASE_URL = 'https://api.megapot.io/api/v1';
const MEGAPOT_API_KEY = process.env.NEXT_PUBLIC_MEGAPOT_API_KEY;

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

    // Validate endpoint to prevent SSRF attacks
    const allowedEndpoints = [
      '/jackpot-round-stats/active',
      '/ticket-purchases',
      '/giveaways/daily-giveaway-winners'
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
    
    // Add CORS headers to allow frontend access
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
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