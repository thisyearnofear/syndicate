/**
 * Season scoring service — unit tests with a fully mocked chain + DB.
 *
 * Verifies the honest accounting rules:
 * - quick crews are credited for purchases by their active seat addresses
 * - syndicate crews are credited for purchases by their coordinator address
 * - V2 `TicketPurchased` counts ticketCount; classic `UserTicketPurchase`
 *   counts ticketsPurchasedTotalBps / 10_000
 * - non-target buyers are never credited
 * - RPC failures skip spans (counted, never faked) and never crash the scan
 */

import type { SeasonRow, SeasonCrewRow, SeasonCrewMemberRow } from '@/lib/db/repositories/seasonRepository';

jest.mock('@/lib/db/repositories/seasonRepository', () => ({
  listSeasonCrews: jest.fn(),
  listCrewMembers: jest.fn(),
}));

jest.mock('@/services/season/megapotReceipts', () => ({
  getMegapotAddressesForChain: jest.fn(() => ['0xMEGAPOTCONTRACT0000000000000000000000000001' as `0x${string}`]),
}));

// Decoded-event fixtures the viem mock returns per ABI (set by each test).
const decodedFixtures: { v2: unknown[]; classic: unknown[] } = { v2: [], classic: [] };

jest.mock('viem', () => {
  const actual = jest.requireActual('viem');
  return {
    ...actual,
    parseEventLogs: jest.fn(({ abi, logs }: { abi: Array<{ name?: string }>; logs: unknown[] }) => {
      // Respect empty raw input — only decode when the span actually had logs.
      if (!logs || logs.length === 0) return [] as never;
      const name = abi?.[0]?.name;
      if (name === 'TicketPurchased') return decodedFixtures.v2 as never;
      if (name === 'UserTicketPurchase') return decodedFixtures.classic as never;
      return [] as never;
    }),
  };
});

const HEAD_BLOCK = 100_000n;
const NOW_SEC = Math.floor(Date.now() / 1000);
// Mutable behavior switch so one test can force RPC failures without re-mocking.
const chainBehavior = { failGetLogs: false };

jest.mock('@/lib/baseClient', () => ({
  getBaseClientForChain: jest.fn(() => ({
    getBlockNumber: jest.fn(async () => HEAD_BLOCK),
    getBlock: jest.fn(async ({ blockNumber }: { blockNumber?: bigint | 'latest' }) => ({
      number: blockNumber === 'latest' ? HEAD_BLOCK : blockNumber,
      timestamp: BigInt(NOW_SEC),
    })),
    getLogs: jest.fn(async ({ fromBlock }: { fromBlock: bigint }) => {
      if (chainBehavior.failGetLogs) throw new Error('limit exceeded');
      // Only one span "has logs" — the one containing block 99_500.
      return fromBlock <= 99_500n && 99_500n <= fromBlock + 1_999n ? [{}] : [];
    }),
  })),
}));

import { scoreSeasonCrews } from '@/services/season/scoringService';
import { listSeasonCrews, listCrewMembers } from '@/lib/db/repositories/seasonRepository';

const season = (id: string): SeasonRow => ({
  id,
  name: 'Test Season',
  chainId: 84532,
  drawWindowStart: 0, // → capped scan of the most recent MAX_SCAN_BLOCKS
  drawWindowEnd: (NOW_SEC + 3600) * 1000,
  status: 'active',
  minChestUsdc: '1',
  inactivityDraws: 3,
  createdAt: new Date().toISOString(),
});

const crew = (id: string, kind: 'quick' | 'syndicate', coordinator: string): SeasonCrewRow => ({
  id,
  seasonId: 'x',
  name: `Crew ${id}`,
  crestAccent: '#8b5cf6',
  kind,
  syndicatePoolId: null,
  coordinatorAddress: coordinator,
  referrerCode: `CREW-${id.toUpperCase()}`,
  status: 'active',
  createdAt: new Date().toISOString(),
  activeMembers: 1,
});

const member = (crewId: string, address: string, status: SeasonCrewMemberRow['seatStatus']): SeasonCrewMemberRow => ({
  id: `${crewId}-${address}`,
  crewId,
  memberAddress: address,
  seatStatus: status,
  joinedAt: new Date().toISOString(),
  freedAt: null,
  lastContributionDraw: null,
  cutBps: 10_000,
  joinTxHash: null,
});

beforeEach(() => {
  decodedFixtures.v2 = [];
  decodedFixtures.classic = [];
  (listCrewMembers as jest.Mock).mockReset();
});

test('empty season → zero scores, ok summary', async () => {
  (listSeasonCrews as jest.Mock).mockResolvedValue([]);
  const result = await scoreSeasonCrews(season('empty'));
  expect(result.scores).toEqual({});
  expect(result.summary.ok).toBe(true);
});

test('V2 purchase credits the quick crew of the buyer seat', async () => {
  const c1 = crew('alpha', 'quick', '0x0000000000000000000000000000000000000000');
  const c2 = crew('beta', 'quick', '0x0000000000000000000000000000000000000000');
  (listSeasonCrews as jest.Mock).mockResolvedValue([c1, c2]);
  (listCrewMembers as jest.Mock).mockImplementation(async (crewId: string) =>
    crewId === 'alpha'
      ? [member('alpha', '0xAaAa000000000000000000000000000000000001', 'active')]
      : [member('beta', '0xBbBb000000000000000000000000000000000002', 'active')],
  );
  decodedFixtures.v2 = [
    { args: { buyer: '0xAaAa000000000000000000000000000000000001', ticketCount: 7n } },
    { args: { buyer: '0xCcCc000000000000000000000000000000000099', ticketCount: 3n } }, // not a member
  ];

  const result = await scoreSeasonCrews(season('v2test'));
  expect(result.scores['alpha']).toEqual({ purchases: 1, entries: 7 });
  expect(result.scores['beta']).toEqual({ purchases: 0, entries: 0 });
  expect(result.summary.ok).toBe(true);
});

test('classic purchase credits via bps/10000 and freed seats do not score', async () => {
  const c1 = crew('gamma', 'quick', '0x0000000000000000000000000000000000000000');
  (listSeasonCrews as jest.Mock).mockResolvedValue([c1]);
  (listCrewMembers as jest.Mock).mockResolvedValue([
    member('gamma', '0xDDdd000000000000000000000000000000000003', 'active'),
    member('gamma', '0xEEee000000000000000000000000000000000004', 'freed_exit'),
  ]);
  decodedFixtures.classic = [
    { args: { buyer: '0xDDdd000000000000000000000000000000000003', ticketsPurchasedTotalBps: 20_000n } },
    { args: { buyer: '0xEEee000000000000000000000000000000000004', ticketsPurchasedTotalBps: 50_000n } },
  ];

  const result = await scoreSeasonCrews(season('classictest'));
  expect(result.scores['gamma'].purchases).toBe(1);
  expect(result.scores['gamma'].entries).toBeCloseTo(2);
});

test('syndicate crew credits coordinator purchases', async () => {
  const c1 = crew('delta', 'syndicate', '0xFfFf000000000000000000000000000000000005');
  (listSeasonCrews as jest.Mock).mockResolvedValue([c1]);
  (listCrewMembers as jest.Mock).mockResolvedValue([]);
  decodedFixtures.v2 = [
    { args: { buyer: '0xFfFf000000000000000000000000000000000005', ticketCount: 12n } },
  ];

  const result = await scoreSeasonCrews(season('syndicatetest'));
  expect(result.scores['delta']).toEqual({ purchases: 1, entries: 12 });
});

test('RPC failures are skipped and counted, never fatal', async () => {
  const c1 = crew('omega', 'quick', '0x0000000000000000000000000000000000000000');
  (listSeasonCrews as jest.Mock).mockResolvedValue([c1]);
  (listCrewMembers as jest.Mock).mockResolvedValue([
    member('omega', '0x1111000000000000000000000000000000000006', 'active'),
  ]);

  chainBehavior.failGetLogs = true;
  try {
    const result = await scoreSeasonCrews(season('rpctest'));
    expect(result.summary.ok).toBe(true); // degrades, does not crash
    expect(result.summary.skippedSpans).toBeGreaterThan(0);
    expect(result.scores['omega']).toEqual({ purchases: 0, entries: 0 });
  } finally {
    chainBehavior.failGetLogs = false;
  }
});
