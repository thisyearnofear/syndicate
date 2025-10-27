import { NextResponse } from 'next/server';

// ENHANCEMENT FIRST: Enhanced syndicate data with additional fields for purchase modal
const mockSyndicates = [
  {
    id: '1',
    name: 'Ocean Warriors',
    cause: 'Ocean Cleanup',
    membersCount: 1247,
    imageUrl: '/images/ocean-cleanup.jpg',
    description: 'Join the fight to clean our oceans and protect marine life',
    // Enhanced fields for purchase modal
    causePercentage: 20,
    ticketsPooled: 3420,
    totalImpact: 8500,
    isActive: true,
    isTrending: true,
    recentActivity: [
      { type: 'join', count: 23, timeframe: 'last hour' },
      { type: 'tickets', count: 156, timeframe: 'today' }
    ]
  },
  {
    id: '2', 
    name: 'Education First',
    cause: 'Education Access',
    membersCount: 892,
    imageUrl: '/images/education.jpg',
    description: 'Ensuring quality education access for all communities',
    // Enhanced fields
    causePercentage: 25,
    ticketsPooled: 2180,
    totalImpact: 12300,
    isActive: true,
    isTrending: false,
    recentActivity: [
      { type: 'join', count: 8, timeframe: 'last hour' },
      { type: 'tickets', count: 89, timeframe: 'today' }
    ]
  },
  {
    id: '3',
    name: 'Climate Action',
    cause: 'Climate Action', 
    membersCount: 2156,
    imageUrl: '/images/climate.jpg',
    description: 'Taking action against climate change for a sustainable future',
    // Enhanced fields
    causePercentage: 30,
    ticketsPooled: 5670,
    totalImpact: 15600,
    isActive: true,
    isTrending: true,
    recentActivity: [
      { type: 'join', count: 45, timeframe: 'last hour' },
      { type: 'tickets', count: 234, timeframe: 'today' }
    ]
  },
  {
    id: '4',
    name: 'Food Security',
    cause: 'Food Security',
    membersCount: 634,
    imageUrl: '/images/food-security.jpg',
    description: 'Fighting hunger and ensuring food security worldwide',
    // Enhanced fields
    causePercentage: 20,
    ticketsPooled: 1890,
    totalImpact: 4200,
    isActive: true,
    isTrending: false,
    recentActivity: [
      { type: 'join', count: 12, timeframe: 'last hour' },
      { type: 'tickets', count: 67, timeframe: 'today' }
    ]
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