/**
 * SYNDICATES API ROUTE TESTS
 *
 * Tests for /api/syndicates endpoints (GET, POST, OPTIONS).
 * Mocks syndicateRepository, syndicateService, basePublicClient,
 * and verifies CRUD operations, validation, and CORS.
 */

import { NextRequest } from 'next/server';

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
    createPool: jest.fn(),
  },
}));

// Mock base client (viem public client)
jest.mock('@/lib/baseClient', () => ({
  basePublicClient: {
    getTransactionReceipt: jest.fn(),
  },
}));

// Mock viem functions
jest.mock('viem', () => ({
  isHex: jest.fn((val: string) => /^0x[0-9a-fA-F]+$/.test(val)),
  parseUnits: jest.fn((value: string, decimals: number) =>
    BigInt(Math.floor(parseFloat(value) * 10 ** decimals))
  ),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock checkRateLimit to allow requests by default
jest.mock('@/lib/api/response', () => {
  const actual = jest.requireActual('@/lib/api/response');
  return {
    ...actual,
    checkRateLimit: jest.fn().mockReturnValue({
      allowed: true,
      remaining: 59,
      resetAt: Date.now() + 60_000,
    }),
  };
});

// Mock ERC20 ABI constant
jest.mock('@/abis/erc20', () => ({
  ERC20_TRANSFER_TOPIC: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
}));

// Import after all mocks
import { GET, POST, OPTIONS } from '@/app/api/syndicates/route';
import { syndicateRepository } from '@/lib/db/repositories/syndicateRepository';
import { syndicateService } from '@/domains/syndicate/services/syndicateService';
import { checkRateLimit } from '@/lib/api/response';

const mockedRepo = syndicateRepository as jest.Mocked<typeof syndicateRepository>;
const mockedService = syndicateService as jest.Mocked<typeof syndicateService>;
const mockedCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeGetRequest(path = '/api/syndicates', searchParams?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url.toString());
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/syndicates', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const mockPoolRow = {
  id: 'pool-1',
  name: 'Test Pool',
  description: 'A test pool',
  coordinator_address: '0x1234567890123456789012345678901234567890',
  members_count: 5,
  total_pooled_usdc: '1000',
  tickets_purchased: 500,
  total_impact_usdc: '200',
  cause_allocation_percent: 20,
  privacy_enabled: false,
  pool_public_key: null,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  pool_type: 'safe' as const,
  safe_address: '0xsafe',
  split_address: null,
  pt_vault_address: null,
  vault_strategy: 'aave',
  lottery_id: null,
};

describe('Syndicates API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 59,
      resetAt: Date.now() + 60_000,
    });
  });

  // =========================================================================
  // GET - List syndicates
  // =========================================================================

  describe('GET /api/syndicates', () => {
    it('returns list of active syndicates', async () => {
      mockedRepo.getActivePools.mockResolvedValue([mockPoolRow]);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Test Pool');
      expect(data[0].ticketsPurchased).toBe(500);
    });

    it('returns empty array when no syndicates exist', async () => {
      mockedRepo.getActivePools.mockResolvedValue([]);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('maps pool fields to SyndicateInfo correctly', async () => {
      mockedRepo.getActivePools.mockResolvedValue([mockPoolRow]);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();
      const syndicate = data[0];

      expect(syndicate.id).toBe('pool-1');
      expect(syndicate.poolAddress).toBe('0xsafe');
      expect(syndicate.causePercentage).toBe(20);
      expect(syndicate.poolType).toBe('safe');
      expect(syndicate.isActive).toBe(true);
      expect(syndicate.vaultStrategy).toBe('aave');
    });
  });

  // =========================================================================
  // GET - Single syndicate by id
  // =========================================================================

  describe('GET /api/syndicates?id=...', () => {
    it('returns a single syndicate when id is provided', async () => {
      mockedRepo.getPoolById.mockResolvedValue(mockPoolRow);

      const request = makeGetRequest('/api/syndicates', { id: 'pool-1' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('pool-1');
      expect(data.name).toBe('Test Pool');
      expect(mockedRepo.getPoolById).toHaveBeenCalledWith('pool-1');
    });

    it('returns 404 for non-existent syndicate id', async () => {
      mockedRepo.getPoolById.mockResolvedValue(null);

      const request = makeGetRequest('/api/syndicates', { id: 'nonexistent' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toMatch(/not found/i);
    });
  });

  // =========================================================================
  // GET - Error handling
  // =========================================================================

  describe('GET - error handling', () => {
    it('returns 500 when repository throws', async () => {
      mockedRepo.getActivePools.mockRejectedValue(new Error('Database connection lost'));

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toMatch(/failed to fetch syndicates/i);
    });
  });

  // =========================================================================
  // POST - create action
  // =========================================================================

  describe('POST - create action', () => {
    it('creates a syndicate with valid fields', async () => {
      mockedService.createPool.mockResolvedValue('new-pool-id');

      const request = makePostRequest({
        action: 'create',
        name: 'New Pool',
        description: 'A new pool',
        coordinatorAddress: '0x1234567890123456789012345678901234567890',
        causeAllocationPercent: 15,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.id).toBe('new-pool-id');
    });

    it('returns 400 when name is missing', async () => {
      const request = makePostRequest({
        action: 'create',
        coordinatorAddress: '0x1234567890123456789012345678901234567890',
        causeAllocationPercent: 15,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/missing required fields/i);
    });

    it('returns 400 when coordinatorAddress is missing', async () => {
      const request = makePostRequest({
        action: 'create',
        name: 'New Pool',
        causeAllocationPercent: 15,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/missing required fields/i);
    });

    it('returns 400 when causeAllocationPercent is missing', async () => {
      const request = makePostRequest({
        action: 'create',
        name: 'New Pool',
        coordinatorAddress: '0x1234567890123456789012345678901234567890',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/missing required fields/i);
    });

    it('returns 400 for invalid pool type', async () => {
      const request = makePostRequest({
        action: 'create',
        name: 'New Pool',
        coordinatorAddress: '0x1234567890123456789012345678901234567890',
        causeAllocationPercent: 15,
        poolType: 'invalid_type',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/invalid pool type/i);
    });
  });

  // =========================================================================
  // POST - join action
  // =========================================================================

  describe('POST - join action', () => {
    it('returns 400 when txHash is missing', async () => {
      const request = makePostRequest({
        action: 'join',
        poolId: 'pool-1',
        memberAddress: '0x456',
        amountUsdc: '100',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/missing txHash/i);
    });

    it('returns 400 when required join fields are missing', async () => {
      const request = makePostRequest({
        action: 'join',
        poolId: 'pool-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/missing required fields/i);
    });

    it('returns 400 for invalid txHash format', async () => {
      const request = makePostRequest({
        action: 'join',
        poolId: 'pool-1',
        memberAddress: '0x456',
        amountUsdc: '100',
        txHash: 'not-a-hex-hash',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/invalid txHash/i);
    });
  });

  // =========================================================================
  // POST - executePurchase action
  // =========================================================================

  describe('POST - executePurchase action', () => {
    it('returns 400 when required fields are missing', async () => {
      const request = makePostRequest({
        action: 'executePurchase',
        poolId: 'pool-1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/missing required fields/i);
    });
  });

  // =========================================================================
  // POST - snapshot action
  // =========================================================================

  describe('POST - snapshot action', () => {
    it('creates a snapshot successfully', async () => {
      mockedService.snapshotProportionalWeights.mockReturnValue({
        strategyId: 'pool-1:adhoc',
        roundId: undefined,
        participants: [],
        createdAt: new Date(),
      });

      const request = makePostRequest({
        action: 'snapshot',
        syndicateId: 'pool-1',
        participants: [{ address: '0x123', contributionUsd: 100 }],
        lockMinutes: 60,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.strategyId).toBe('pool-1:adhoc');
    });
  });

  // =========================================================================
  // POST - unsupported action
  // =========================================================================

  describe('POST - unsupported action', () => {
    it('returns 400 for unsupported action', async () => {
      const request = makePostRequest({ action: 'unknown' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/unsupported action/i);
    });
  });

  // =========================================================================
  // POST - invalid JSON
  // =========================================================================

  describe('POST - invalid request body', () => {
    it('returns 400 for malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/syndicates', {
        method: 'POST',
        body: 'not-json',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  // =========================================================================
  // Rate limiting
  // =========================================================================

  describe('Rate limiting', () => {
    it('returns 429 when GET rate limit is exceeded', async () => {
      mockedCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
      });

      const request = makeGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(429);
    });

    it('returns 429 when POST rate limit is exceeded', async () => {
      mockedCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
      });

      const request = makePostRequest({ action: 'create' });
      const response = await POST(request);

      expect(response.status).toBe(429);
    });
  });

  // =========================================================================
  // OPTIONS - CORS
  // =========================================================================

  describe('OPTIONS', () => {
    it('returns 200 with CORS headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/syndicates', {
        method: 'OPTIONS',
      });

      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });
  });
});
