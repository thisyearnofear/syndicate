import { NextResponse } from 'next/server';

// Mock contribution data for development
const mockContributionData = {
  totalContributions: 125847.32,
  contributorsCount: 3421
};

export async function GET() {
  try {
    // In production, this would fetch from a database
    // For now, return mock data to prevent 404 errors
    return NextResponse.json(mockContributionData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error fetching contribution data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch contribution data',
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