import { NextResponse } from 'next/server';

// ENHANCEMENT FIRST: Enhanced syndicate data with additional fields for purchase modal
const mockSyndicates = [
  {
    id: '1',
    name: 'Ocean Warriors',
    model: 'altruistic',
    distributionModel: 'proportional',
    poolAddress: '0x1111111111111111111111111111111111111111',
    executionDate: new Date('2025-12-01T00:00:00Z'),
    cutoffDate: new Date('2025-11-30T00:00:00Z'),
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
    // New hybrid approach fields
    yieldToTicketsPercentage: 85,
    yieldToCausesPercentage: 15,
    vaultStrategy: 'aave',
    ticketsPooled: 3420,
    totalImpact: 8500,
    isActive: true,
    isTrending: true,
    recentActivity: [
      { type: 'join', count: 23, timeframe: 'last hour' },
      { type: 'tickets', count: 156, timeframe: 'today' },
      { type: 'yield', count: 42, timeframe: 'today', amount: 125 }
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
    model: 'altruistic',
    distributionModel: 'proportional',
    poolAddress: '0x2222222222222222222222222222222222222222',
    executionDate: new Date('2025-12-15T00:00:00Z'),
    cutoffDate: new Date('2025-12-14T00:00:00Z'),
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
    // New hybrid approach fields
    yieldToTicketsPercentage: 80,
    yieldToCausesPercentage: 20,
    vaultStrategy: 'morpho',
    ticketsPooled: 2180,
    totalImpact: 12300,
    isActive: true,
    isTrending: false,
    recentActivity: [
      { type: 'join', count: 8, timeframe: 'last hour' },
      { type: 'tickets', count: 89, timeframe: 'today' },
      { type: 'yield', count: 28, timeframe: 'today', amount: 85 }
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
    model: 'pure',
    distributionModel: 'proportional',
    poolAddress: '0x3333333333333333333333333333333333333333',
    executionDate: new Date('2025-12-20T00:00:00Z'),
    cutoffDate: new Date('2025-12-19T00:00:00Z'),
    membersCount: 2156,
    imageUrl: '/images/climate.jpg',
    description: 'Taking action against climate change for a sustainable future',
    // Enhanced fields
    causePercentage: 0,
    governanceModel: 'hybrid',
    governanceParameters: {
      thresholdAmount: 1000,
      emergencySwitch: true
    },
    // New hybrid approach fields
    yieldToTicketsPercentage: 90,
    yieldToCausesPercentage: 10,
    vaultStrategy: 'octant',
    ticketsPooled: 5670,
    totalImpact: 15600,
    isActive: true,
    isTrending: true,
    recentActivity: [
      { type: 'join', count: 45, timeframe: 'last hour' },
      { type: 'tickets', count: 234, timeframe: 'today' },
      { type: 'yield', count: 67, timeframe: 'today', amount: 180 }
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
    model: 'altruistic',
    distributionModel: 'proportional',
    poolAddress: '0x4444444444444444444444444444444444444444',
    executionDate: new Date('2026-01-01T00:00:00Z'),
    cutoffDate: new Date('2025-12-31T00:00:00Z'),
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
    // New hybrid approach fields
    yieldToTicketsPercentage: 82,
    yieldToCausesPercentage: 18,
    vaultStrategy: 'spark',
    ticketsPooled: 1890,
    totalImpact: 4200,
    isActive: true,
    isTrending: false,
    recentActivity: [
      { type: 'join', count: 12, timeframe: 'last hour' },
      { type: 'tickets', count: 67, timeframe: 'today' },
      { type: 'yield', count: 19, timeframe: 'today', amount: 54 }
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