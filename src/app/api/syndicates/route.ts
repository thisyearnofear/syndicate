import { NextResponse } from 'next/server';

// ENHANCEMENT FIRST: Enhanced syndicate data with additional fields for purchase modal
const mockSyndicates = [
  {
    id: '1',
    name: 'Ocean Warriors',
    membersCount: 1247,
    imageUrl: '/images/ocean-cleanup.jpg',
    description: 'Join the fight to clean our oceans and protect marine life',
    // Enhanced fields for purchase modal
    causePercentage: 20,
    governanceModel: 'leader',
    governanceParameters: {
      maxFundAction: 10,
      actionTimeLimit: 24
    },
    ticketsPooled: 3420,
    totalImpact: 8500,
    isActive: true,
    isTrending: true,
    recentActivity: [
      { type: 'join', count: 23, timeframe: 'last hour' },
      { type: 'tickets', count: 156, timeframe: 'today' }
    ],
    cause: {
      id: 'ocean-cleanup-1',
      name: 'Ocean Cleanup',
      verifiedWallet: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      description: 'Removing plastic waste from our oceans',
      verificationSource: 'gitcoin',
      verificationScore: 95,
      verificationTimestamp: new Date('2024-01-15'),
      verificationTier: 1
    }
  },
  {
    id: '2', 
    name: 'Education First',
    membersCount: 892,
    imageUrl: '/images/education.jpg',
    description: 'Ensuring quality education access for all communities',
    // Enhanced fields
    causePercentage: 25,
    governanceModel: 'dao',
    governanceParameters: {
      quorumPercentage: 50,
      executionDelay: 168 // 7 days in hours
    },
    ticketsPooled: 2180,
    totalImpact: 12300,
    isActive: true,
    isTrending: false,
    recentActivity: [
      { type: 'join', count: 8, timeframe: 'last hour' },
      { type: 'tickets', count: 89, timeframe: 'today' }
    ],
    cause: {
      id: 'education-access-2',
      name: 'Education Access',
      verifiedWallet: '0x742d35Cc6634C0532925a3b844Bc454e4438f44f',
      description: 'Ensuring quality education for all communities',
      verificationSource: 'gitcoin',
      verificationScore: 88,
      verificationTimestamp: new Date('2024-02-20'),
      verificationTier: 1
    }
  },
  {
    id: '3',
    name: 'Climate Action',
    membersCount: 2156,
    imageUrl: '/images/climate.jpg',
    description: 'Taking action against climate change for a sustainable future',
    // Enhanced fields
    causePercentage: 30,
    governanceModel: 'hybrid',
    governanceParameters: {
      thresholdAmount: 1000,
      emergencySwitch: true
    },
    ticketsPooled: 5670,
    totalImpact: 15600,
    isActive: true,
    isTrending: true,
    recentActivity: [
      { type: 'join', count: 45, timeframe: 'last hour' },
      { type: 'tickets', count: 234, timeframe: 'today' }
    ],
    cause: {
      id: 'climate-action-3',
      name: 'Climate Action',
      verifiedWallet: '0x742d35Cc6634C0532925a3b844Bc454e4438f450',
      description: 'Taking action against climate change for a sustainable future',
      verificationSource: 'community',
      verificationScore: 92,
      verificationTimestamp: new Date('2024-03-10'),
      verificationTier: 2
    }
  },
  {
    id: '4',
    name: 'Food Security',
    membersCount: 634,
    imageUrl: '/images/food-security.jpg',
    description: 'Fighting hunger and ensuring food security worldwide',
    // Enhanced fields
    causePercentage: 20,
    governanceModel: 'leader',
    governanceParameters: {
      maxFundAction: 5,
      actionTimeLimit: 48
    },
    ticketsPooled: 1890,
    totalImpact: 4200,
    isActive: true,
    isTrending: false,
    recentActivity: [
      { type: 'join', count: 12, timeframe: 'last hour' },
      { type: 'tickets', count: 67, timeframe: 'today' }
    ],
    cause: {
      id: 'food-security-4',
      name: 'Food Security',
      verifiedWallet: '0x742d35Cc6634C0532925a3b844Bc454e4438f451',
      description: 'Fighting hunger and ensuring food security worldwide',
      verificationSource: 'manual',
      verificationScore: 85,
      verificationTimestamp: new Date('2024-04-05'),
      verificationTier: 3
    }
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