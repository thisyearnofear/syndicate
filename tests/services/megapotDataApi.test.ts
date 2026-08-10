/**
 * MEGAPOT DATA API CLIENT TESTS
 *
 * Tests for src/services/lotteries/megapotDataApi.ts:
 * request contract, error-envelope handling, caching, and the
 * never-throw resilience contract (all helpers return null on failure).
 */

let mockFetch: jest.Mock;

jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Import AFTER mocks
import {
    getActiveRound,
    getWalletTickets,
    getRoundWins,
    megapotAmountToUsd,
    clearMegapotApiCache,
} from '@/services/lotteries/megapotDataApi';

const ACTIVE_ROUND = {
    id: '139',
    status: 'active',
    prize_pool: { amount: '1104105694137', decimals: 6 },
    ticket_count: 2269,
    unique_participants: 265,
    winners_count: 0,
    top_prize_amount: null,
    top_prize_winners_count: 0,
    lp_earnings: { amount: '0', decimals: 6 },
    started_at: '2026-08-09T17:00:23.000Z',
    ended_at: '2026-08-10T17:00:00.000Z',
    settled_at: null,
    ball_pool: { normals_max: 30, bonusball_max: 10 },
    winning_numbers: null,
    prize_tiers: null,
};

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as unknown as Response;
}

describe('megapotDataApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearMegapotApiCache();
        mockFetch = jest.fn();
        (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
    });

    describe('getActiveRound', () => {
        it('returns the active round on success', async () => {
            mockFetch.mockResolvedValue(jsonResponse(ACTIVE_ROUND));

            const round = await getActiveRound();

            expect(round).not.toBeNull();
            expect(round!.id).toBe('139');
            expect(round!.status).toBe('active');
            expect(round!.ball_pool).toEqual({ normals_max: 30, bonusball_max: 10 });
        });

        it('hits the documented v1 base URL', async () => {
            mockFetch.mockResolvedValue(jsonResponse(ACTIVE_ROUND));

            await getActiveRound();

            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://api.megapot.io/v1/rounds/active');
        });

        it('sends a Bearer key when configured', async () => {
            process.env.MEGAPOT_API_KEY = 'mpk_live_testkey12345678901';
            mockFetch.mockResolvedValue(jsonResponse(ACTIVE_ROUND));

            await getActiveRound();

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect((init.headers as Record<string, string>).Authorization).toBe('Bearer mpk_live_testkey12345678901');

            delete process.env.MEGAPOT_API_KEY;
        });

        it('caches repeat calls within the TTL', async () => {
            mockFetch.mockResolvedValue(jsonResponse(ACTIVE_ROUND));

            await getActiveRound();
            await getActiveRound();

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('returns null (does not throw) on API error envelope', async () => {
            mockFetch.mockResolvedValue(
                jsonResponse({ error: { code: 'internal_error', message: 'boom', request_id: 'req_1' } }, 500)
            );

            const round = await getActiveRound();

            expect(round).toBeNull();
        });

        it('returns null (does not throw) on network failure', async () => {
            mockFetch.mockRejectedValue(new Error('network down'));

            const round = await getActiveRound();

            expect(round).toBeNull();
        });
    });

    describe('getWalletTickets', () => {
        it('maps the paginated response through', async () => {
            mockFetch.mockResolvedValue(jsonResponse({
                data: [
                    {
                        id: '1198602',
                        wallet: '0xb9A416db4EDEF497eA7e7A095FC7256094B09c19',
                        buyer: '0x41c9ec8bb080171e8488964804E9Deab28C13A8b',
                        round_id: '139',
                        user_ticket_id: '1',
                        normals: [7, 9, 12, 17, 20],
                        bonusball: 9,
                        matched_normals: null,
                        bonusball_match: null,
                        winnings_amount: null,
                        claimed: false,
                        claimed_tx_hash: null,
                        tx_hash: '0x3b51076c908d163502c9c5fbaddfdb4b8a418849f61499e79e9a981e6f99c981',
                        block_number: 49790153,
                        created_at: '2026-08-10T13:47:33.000Z',
                    },
                ],
                next_cursor: null,
                has_more: false,
            }));

            const page = await getWalletTickets('0x1234567890123456789012345678901234567890');

            expect(page).not.toBeNull();
            expect(page!.data).toHaveLength(1);
            expect(page!.data[0].round_id).toBe('139');
            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('/v1/wallets/0x1234567890123456789012345678901234567890/tickets?limit=50');
        });
    });

    describe('megapotAmountToUsd', () => {
        it('formats whole and fractional USDC amounts', () => {
            expect(megapotAmountToUsd({ amount: '1104105694137', decimals: 6 })).toBe('1104105.694137');
            expect(megapotAmountToUsd({ amount: '1111112', decimals: 6 })).toBe('1.111112');
            expect(megapotAmountToUsd({ amount: '5000000', decimals: 6 })).toBe('5');
        });

        it('handles null/undefined amounts as 0', () => {
            expect(megapotAmountToUsd(null)).toBe('0');
            expect(megapotAmountToUsd(undefined)).toBe('0');
        });
    });

    describe('getRoundWins', () => {
        it('returns paginated wins for a round', async () => {
            mockFetch.mockResolvedValue(jsonResponse({
                data: [{ wallet: '0xabc', amount: { amount: '2282795640', decimals: 6 } }],
                next_cursor: null,
                has_more: false,
            }));

            const wins = await getRoundWins('138', 10);

            expect(wins!.data).toHaveLength(1);
            const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('/v1/rounds/138/wins?limit=10');
        });
    });
});
