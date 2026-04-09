import { NextRequest, NextResponse } from 'next/server';
import { API } from '@/config';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getCandidateBaseUrls(): string[] {
  const configured = normalizeBaseUrl(API.megapot.baseUrl);
  const candidates = [
    configured,
    configured.replace(/\/api\/v2$/i, ''),
    'https://api.megapot.io/api/v2',
  ];
  return [...new Set(candidates)];
}

function getEndpointVariants(endpoint: string): string[] {
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const lotteryPrefixed = normalized.startsWith('/lottery/')
    ? normalized
    : `/lottery${normalized}`;
  return [...new Set([normalized, lotteryPrefixed])];
}

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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key to headers if available
    if (API.megapot.apiKey) {
      headers['apikey'] = API.megapot.apiKey;
    }

    const baseUrls = getCandidateBaseUrls();
    const endpointVariants = getEndpointVariants(endpoint);

    let response: Response | null = null;
    let responseBody = '';
    let lastStatus = 502;

    for (const baseUrl of baseUrls) {
      for (const endpointVariant of endpointVariants) {
        const url = `${baseUrl}${endpointVariant}`;
        const attempt = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(30000),
        });

        if (attempt.ok) {
          response = attempt;
          break;
        }

        lastStatus = attempt.status;
        responseBody = await attempt.text();
      }

      if (response) break;
    }

    if (!response) {
      console.error(`Megapot API error: ${lastStatus} - ${responseBody}`);
      return NextResponse.json(
        {
          error: `Megapot API error: ${lastStatus}`,
          details: responseBody || 'No successful Megapot endpoint variant found',
        },
        { status: lastStatus >= 400 ? lastStatus : 502 }
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
