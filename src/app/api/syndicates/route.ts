import { NextResponse } from 'next/server';

// Mock syndicate data for development
const mockSyndicates = [
  {
    id: '1',
    name: 'Ocean Warriors Collective',
    cause: 'Ocean Cleanup',
    membersCount: 1247,
    imageUrl: '/images/ocean-cleanup.jpg'
  },
  {
    id: '2', 
    name: 'Education First Alliance',
    cause: 'Education Access',
    membersCount: 892,
    imageUrl: '/images/education.jpg'
  },
  {
    id: '3',
    name: 'Climate Action Network',
    cause: 'Climate Action', 
    membersCount: 2156,
    imageUrl: '/images/climate.jpg'
  },
  {
    id: '4',
    name: 'Food Security Initiative',
    cause: 'Food Security',
    membersCount: 634,
    imageUrl: '/images/food-security.jpg'
  }
];

export async function GET() {
  try {
    // In production, this would fetch from a database
    // For now, return mock data to prevent 404 errors
    return NextResponse.json(mockSyndicates, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error fetching syndicates:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch syndicates',
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