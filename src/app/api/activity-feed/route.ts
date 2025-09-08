import { NextResponse } from 'next/server';

// Mock activity feed data for development
const mockActivities = [
  {
    id: '1',
    timestamp: Date.now() - 300000, // 5 minutes ago
    message: 'Sarah joined Ocean Warriors Collective syndicate'
  },
  {
    id: '2', 
    timestamp: Date.now() - 900000, // 15 minutes ago
    message: 'Climate Action Network purchased 25 lottery tickets'
  },
  {
    id: '3',
    timestamp: Date.now() - 1800000, // 30 minutes ago
    message: 'Education First Alliance won $500 in daily giveaway'
  },
  {
    id: '4',
    timestamp: Date.now() - 3600000, // 1 hour ago
    message: 'Food Security Initiative reached 600 members milestone'
  },
  {
    id: '5',
    timestamp: Date.now() - 7200000, // 2 hours ago
    message: 'New syndicate "Healthcare Heroes" was created'
  },
  {
    id: '6',
    timestamp: Date.now() - 10800000, // 3 hours ago
    message: 'Ocean Warriors Collective donated $1,200 to ocean cleanup'
  }
];

export async function GET() {
  try {
    // In production, this would fetch from a database
    // For now, return mock data to prevent 404 errors
    return NextResponse.json(mockActivities, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch activity feed',
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