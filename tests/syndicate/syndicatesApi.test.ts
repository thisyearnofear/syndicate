/**
 * SYNDICATES API TESTS
 * 
 * Tests for /api/syndicates endpoints
 */

import { NextRequest } from 'next/server';
import { syndicateRepository } from '@/lib/db/repositories/syndicateRepository';
import { syndicateService } from '@/domains/syndicate/services/syndicateService';

// Mock the repository
jest.mock('@/lib/db/repositories/syndicateRepository', () => ({
  syndicateRepository: {
    createPool: jest.fn(),
    getPoolById: jest.fn(),
    getActivePools: jest.fn(),
    addMember: jest.fn(),
    recordTicketPurchase: jest.fn(),
    getPoolStats: jest.fn(),
  },
}));

// Mock the service
jest.mock('@/domains/syndicate/services/syndicateService', () => ({
  syndicateService: {
    executeSyndicatePurchase: jest.fn(),
    snapshotProportionalWeights: jest.fn(),
  },
}));

// Import after mocking
import { GET, POST } from '@/app/api/syndicates/route';

describe('Syndicates API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/syndicates', () => {
    it('should return all active syndicates', async () => {
      const mockPools = [
        {
          id: '1',
          name: 'Test Pool',
          description: 'Test description',
          coordinator_address: '0x123',
          members_count: 10,
          total_pooled_usdc: '1000',
          tickets_purchased: 1000,
          total_impact_usdc: '200',
          cause_allocation_percent: 20,
          privacy_enabled: false,
          pool_public_key: null,
          is_active: true,
          created_at: '1234567890',
          updated_at: '1234567890',
        },
      ];

      (syndicateRepository.getActivePools as jest.Mock).mockResolvedValue(mockPools);

      const request = new NextRequest('http://localhost/api/syndicates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].name).toBe('Test Pool');
      expect(data[0].ticketsPurchased).toBe(1000);
    });

    it('should return a single syndicate when id is provided', async () => {
      const mockPool = {
        id: '1',
        name: 'Test Pool',
        description: 'Test description',
        coordinator_address: '0x123',
        members_count: 10,
        total_pooled_usdc: '1000',
        tickets_purchased: 1000,
        total_impact_usdc: '200',
        cause_allocation_percent: 20,
        privacy_enabled: false,
        pool_public_key: null,
        is_active: true,
        created_at: '1234567890',
        updated_at: '1234567890',
      };

      (syndicateRepository.getPoolById as jest.Mock).mockResolvedValue(mockPool);

      const request = new NextRequest('http://localhost/api/syndicates?id=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('1');
      expect(data.name).toBe('Test Pool');
    });

    it('should return 404 for non-existent syndicate', async () => {
      (syndicateRepository.getPoolById as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/syndicates?id=999');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Syndicate not found');
    });

    it('should handle database errors', async () => {
      (syndicateRepository.getActivePools as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/syndicates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch syndicates');
    });
  });

  describe('POST /api/syndicates', () => {
    describe('create action', () => {
      it('should create a new syndicate', async () => {
        const mockPoolId = 'new-pool-id';
        (syndicateRepository.createPool as jest.Mock).mockResolvedValue(mockPoolId);

        const requestBody = {
          action: 'create',
          name: 'New Pool',
          description: 'New description',
          coordinatorAddress: '0x123',
          causeAllocationPercent: 20,
        };

        const request = new NextRequest('http://localhost/api/syndicates', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.id).toBe(mockPoolId);
      });

      it('should return 400 for missing required fields', async () => {
        const requestBody = {
          action: 'create',
          name: 'New Pool',
          // Missing coordinatorAddress and causeAllocationPercent
        };

        const request = new NextRequest('http://localhost/api/syndicates', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Missing required fields');
      });
    });

    describe('join action', () => {
      it('should add a member to a pool', async () => {
        (syndicateRepository.addMember as jest.Mock).mockResolvedValue(true);

        const requestBody = {
          action: 'join',
          poolId: 'pool-1',
          memberAddress: '0x456',
          amountUsdc: '100',
        };

        const request = new NextRequest('http://localhost/api/syndicates', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });
    });

    describe('executePurchase action', () => {
      it('should execute a syndicate purchase', async () => {
        const mockResult = { success: true, txHash: '0xabc' };
        (syndicateService.executeSyndicatePurchase as jest.Mock).mockResolvedValue(mockResult);
        (syndicateRepository.recordTicketPurchase as jest.Mock).mockResolvedValue(true);

        const requestBody = {
          action: 'executePurchase',
          poolId: 'pool-1',
          ticketCount: 10,
          coordinatorAddress: '0x123',
        };

        const request = new NextRequest('http://localhost/api/syndicates', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.txHash).toBe('0xabc');
        expect(syndicateRepository.recordTicketPurchase).toHaveBeenCalledWith('pool-1', 10, '0xabc');
      });
    });

    describe('snapshot action', () => {
      it('should create a snapshot', async () => {
        const mockSnapshot = { snapshotId: 'snapshot-1', createdAt: '2024-01-01' };
        (syndicateService.snapshotProportionalWeights as jest.Mock).mockReturnValue(mockSnapshot);

        const requestBody = {
          action: 'snapshot',
          syndicateId: 'pool-1',
          participants: [{ address: '0x123', contributionUsd: 100 }],
          lockMinutes: 60,
        };

        const request = new NextRequest('http://localhost/api/syndicates', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.snapshotId).toBe('snapshot-1');
      });
    });

    it('should return 400 for unsupported action', async () => {
      const requestBody = {
        action: 'unsupported',
      };

      const request = new NextRequest('http://localhost/api/syndicates', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unsupported action');
    });
  });
});