/**
 * BALANCE API ROUTE TESTS
 *
 * Tests for /api/balance endpoints (GET, POST, OPTIONS).
 * Mocks ethers JsonRpcProvider/Contract for EVM balance fetching,
 * and verifies address validation, chain routing, and rate limiting.
 */

import { NextRequest } from 'next/server';

// Mock ethers before importing the route
const mockBalanceOf = jest.fn();
const mockDecimals = jest.fn();

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
      Contract: jest.fn().mockImplementation(() => ({
        balanceOf: mockBalanceOf,
        decimals: mockDecimals,
      })),
      formatUnits: jest.fn((value: bigint, decimals: number) => {
        const divisor = BigInt(10 ** decimals);
        const whole = value / divisor;
        const fraction = value % divisor;
        return fraction > 0
          ? `${whole}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`
          : whole.toString();
      }),
    },
  };
});

// Mock @near-js/providers
jest.mock('@near-js/providers', () => ({
  JsonRpcProvider: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
  })),
}));

// Mock logger to suppress console output
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

// Import after all mocks are set up
import { GET, POST, OPTIONS } from '@/app/api/balance/route';
import { checkRateLimit } from '@/lib/api/response';

const mockedCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeGetRequest(address?: string, chainId?: number): NextRequest {
  const params = new URLSearchParams();
  if (address) params.set('address', address);
  if (chainId) params.set('chainId', String(chainId));
  const qs = params.toString();
  return new NextRequest(`http://localhost:3000/api/balance${qs ? `?${qs}` : ''}`);
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/balance', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Balance API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 59,
      resetAt: Date.now() + 60_000,
    });
  });

  // =========================================================================
  // GET - Address validation
  // =========================================================================

  describe('GET - address validation', () => {
    it('returns 400 when address is missing', async () => {
      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/missing address/i);
    });

    it('returns 400 for invalid address format', async () => {
      const request = makeGetRequest('not-a-valid-address');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/invalid address/i);
    });

    it('returns 400 for address that is too short', async () => {
      const request = makeGetRequest('0x123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });
  });

  // =========================================================================
  // GET - EVM balance
  // =========================================================================

  describe('GET - EVM balance', () => {
    const evmAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88';

    it('returns USDC balance for valid EVM address', async () => {
      mockBalanceOf.mockResolvedValue(BigInt(5000000)); // 5 USDC (6 decimals)
      mockDecimals.mockResolvedValue(6);

      const request = makeGetRequest(evmAddress);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.usdc).toBe('5');
      expect(data.balance).toBe('5');
      expect(data.wallet).toBe(evmAddress);
      expect(data.chain).toBe('base');
    });

    it('returns balance for Ethereum chain when chainId=1', async () => {
      mockBalanceOf.mockResolvedValue(BigInt(10000000)); // 10 USDC
      mockDecimals.mockResolvedValue(6);

      const request = makeGetRequest(evmAddress, 1);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.usdc).toBe('10');
      expect(data.chain).toBe('ethereum');
      expect(data.chainId).toBe(1);
    });

    it('defaults to Base chain (8453) when no chainId provided', async () => {
      mockBalanceOf.mockResolvedValue(BigInt(0));
      mockDecimals.mockResolvedValue(6);

      const request = makeGetRequest(evmAddress);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chain).toBe('base');
    });

    it('returns zero balance when contract call fails', async () => {
      mockBalanceOf.mockRejectedValue(new Error('Provider unavailable'));

      const request = makeGetRequest(evmAddress);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.usdc).toBe('0');
      expect(data.error).toBe('Provider unavailable');
    });
  });

  // =========================================================================
  // GET - Solana address routing
  // =========================================================================

  describe('GET - Solana address routing', () => {
    it('routes Solana addresses to Solana handler', async () => {
      const solanaAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      // Mock global fetch for Solana RPC
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              value: [
                {
                  account: {
                    data: {
                      parsed: {
                        info: { tokenAmount: { uiAmount: 42.5 } },
                      },
                    },
                  },
                },
              ],
            },
          }),
      });

      const request = makeGetRequest(solanaAddress);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chain).toBe('solana');
      expect(data.solana).toBe('42.5');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('returns zero when Solana RPC returns no token accounts', async () => {
      const solanaAddress = '11111111111111111111111111111111';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            result: { value: [] },
          }),
      });

      const request = makeGetRequest(solanaAddress);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.solana).toBe('0');
    });
  });

  // =========================================================================
  // GET - Stacks address routing
  // =========================================================================

  describe('GET - Stacks address routing', () => {
    it('routes Stacks addresses to Stacks handler', async () => {
      const stacksAddress = 'SP1234567890123456789012345678';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            fungible_tokens: {},
          }),
      });

      const request = makeGetRequest(stacksAddress);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chain).toBe('stacks');
      expect(data.usdcx).toBe('0');
      expect(data.sbtc).toBe('0');
    });
  });

  // =========================================================================
  // POST
  // =========================================================================

  describe('POST', () => {
    const evmAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88';

    it('returns balance for valid POST body', async () => {
      mockBalanceOf.mockResolvedValue(BigInt(7500000)); // 7.5 USDC
      mockDecimals.mockResolvedValue(6);

      const request = makePostRequest({ address: evmAddress });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.usdc).toBe('7.5');
      expect(data.wallet).toBe(evmAddress);
    });

    it('returns 400 when POST body has no address', async () => {
      const request = makePostRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/missing address/i);
    });

    it('returns 400 for invalid address in POST body', async () => {
      const request = makePostRequest({ address: 'invalid' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/invalid address/i);
    });

    it('passes chainId from POST body to balance handler', async () => {
      mockBalanceOf.mockResolvedValue(BigInt(2000000));
      mockDecimals.mockResolvedValue(6);

      const request = makePostRequest({ address: evmAddress, chainId: 42161 });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.usdc).toBe('2');
    });
  });

  // =========================================================================
  // Rate limiting
  // =========================================================================

  describe('Rate limiting', () => {
    it('returns 429 when rate limit is exceeded (GET)', async () => {
      mockedCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
      });

      const request = makeGetRequest('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88');
      const response = await GET(request);

      expect(response.status).toBe(429);
    });

    it('returns 429 when rate limit is exceeded (POST)', async () => {
      mockedCheckRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
      });

      const request = makePostRequest({
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88',
      });
      const response = await POST(request);

      expect(response.status).toBe(429);
    });

    it('checks rate limit with IP from x-forwarded-for header', async () => {
      mockBalanceOf.mockResolvedValue(BigInt(0));
      mockDecimals.mockResolvedValue(6);

      const request = new NextRequest(
        'http://localhost:3000/api/balance?address=0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88',
        {
          headers: { 'x-forwarded-for': '192.168.1.1' },
        }
      );

      await GET(request);

      expect(mockedCheckRateLimit).toHaveBeenCalledWith(
        'balance:192.168.1.1',
        expect.objectContaining({ windowMs: 60_000, maxRequests: 120 })
      );
    });

    it('falls back to anonymous IP when no forwarded header', async () => {
      mockBalanceOf.mockResolvedValue(BigInt(0));
      mockDecimals.mockResolvedValue(6);

      const request = makeGetRequest('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD88');
      await GET(request);

      expect(mockedCheckRateLimit).toHaveBeenCalledWith(
        'balance:anonymous',
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // OPTIONS
  // =========================================================================

  describe('OPTIONS', () => {
    it('returns 200 with CORS headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/balance', {
        method: 'OPTIONS',
      });

      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });
  });
});
