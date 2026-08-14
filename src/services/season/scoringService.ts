/**
 * SEASON — CREW ENTRY SCORING
 *
 * Scores each crew from REAL on-chain Megapot purchase events — never
 * bookkeeping, never fabricated. Quick crews are credited for purchases made
 * by any of their seat addresses; syndicate crews are credited for purchases
 * made by their coordinator address (the pooled-entry path the existing
 * syndicate rails use).
 *
 * Handles the Megapot event generations:
 * - Live V2 mainnet:    `RandomTicketsBought(recipient indexed, drawingId indexed, count, cost, ticketIds[])`,
 *                       `TicketPurchased(recipient indexed, currentDrawingId indexed, source indexed,
 *                       userTicketId, normals[], bonusball, ticketHash)` (one per ticket)
 * - Legacy V2:          `TicketPurchased(buyer indexed, ticketCount, referralFeePaid)`
 * - Classic/sepolia:    `UserTicketPurchase(recipient indexed, ticketsPurchasedTotalBps, referrer indexed, buyer indexed)`
 *
 * A single RandomTicketBuyer purchase emits both an RTB summary event and
 * per-ticket jackpot events in the same transaction, so each transaction is
 * credited only once.
 *
 * Best-effort by design: public RPCs cap getLogs ranges, so the window is
 * walked in small spans and any span the RPC rejects is skipped (and counted
 * in the summary, never faked). Results are cached briefly so repeated page
 * loads do not hammer the RPC.
 */

import { parseAbiItem, parseEventLogs, type Log } from 'viem';
import { getBaseClientForChain } from '@/lib/baseClient';
import { getMegapotAddressesForChain } from '@/services/season/megapotReceipts';
import {
  listSeasonCrews,
  listCrewMembers,
  type SeasonRow,
  type SeasonCrewRow,
} from '@/lib/db/repositories/seasonRepository';
import { logger } from '@/lib/logger';

const TICKET_PURCHASED_V2 = parseAbiItem(
  'event TicketPurchased(address indexed buyer, uint256 ticketCount, uint256 referralFeePaid)',
);
const USER_TICKET_PURCHASE = parseAbiItem(
  'event UserTicketPurchase(address indexed recipient, uint256 ticketsPurchasedTotalBps, address indexed referrer, address indexed buyer)',
);
const TICKET_PURCHASED_LIVE_V2 = parseAbiItem(
  'event TicketPurchased(address indexed recipient, uint256 indexed currentDrawingId, bytes32 indexed source, uint256 userTicketId, uint8[] normals, uint8 bonusball, bytes32 ticketHash)',
);
const RANDOM_TICKETS_BOUGHT = parseAbiItem(
  'event RandomTicketsBought(address indexed recipient, uint256 indexed drawingId, uint256 count, uint256 cost, uint256[] ticketIds)',
);

const MAX_SCAN_BLOCKS = Number(process.env.SEASON_SCORE_MAX_BLOCKS ?? 30_000);
const SPAN = 2_000n;
const CACHE_TTL_MS = 90_000;

export interface CrewScore {
  purchases: number;
  entries: number;
}

export interface ScoringSummary {
  ok: boolean;
  fromBlock: string | null;
  toBlock: string | null;
  capped: boolean;
  skippedSpans: number;
  scannedAt: number;
  error?: string;
}

export interface SeasonScores {
  scores: Record<string, CrewScore>; // crewId → score
  summary: ScoringSummary;
}

const cache = new Map<string, { at: number; result: SeasonScores }>();

/** Find the block at or just before a unix-seconds timestamp via binary search. */
async function blockForTimestamp(
  client: ReturnType<typeof getBaseClientForChain>,
  ts: number,
): Promise<bigint | null> {
  try {
    const head = await client.getBlock({ blockTag: 'latest' });
    if (Number(head.timestamp) <= ts) return BigInt(head.number);

    let lo = 0n;
    let hi = BigInt(head.number);
    // Don't chase further back than the scan cap allows anyway.
    const floor = hi > BigInt(MAX_SCAN_BLOCKS) ? hi - BigInt(MAX_SCAN_BLOCKS) : 0n;

    while (lo < hi) {
      const mid = (lo + hi) / 2n;
      const block = await client.getBlock({ blockNumber: mid });
      if (Number(block.timestamp) <= ts) lo = mid + 1n;
      else hi = mid;
    }
    const found = lo > 0n ? lo - 1n : 0n;
    return found < floor ? floor : found;
  } catch (error) {
    logger.debug('[season-scoring] blockForTimestamp failed', {
      ts,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function targetAddressesForCrew(
  crew: SeasonCrewRow,
  memberAddresses: string[],
): Set<string> {
  const targets = new Set<string>();
  if (crew.kind === 'syndicate' && crew.coordinatorAddress) {
    targets.add(crew.coordinatorAddress.toLowerCase());
  }
  if (crew.kind === 'quick') {
    for (const addr of memberAddresses) targets.add(addr.toLowerCase());
  }
  return targets;
}

/**
 * Score all crews in a season from on-chain purchase logs within the
 * season's draw window (capped to MAX_SCAN_BLOCKS most recent blocks).
 */
export async function scoreSeasonCrews(season: SeasonRow): Promise<SeasonScores> {
  const cacheKey = `${season.id}:${season.chainId}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const crews = await listSeasonCrews(season.id);
  const empty: SeasonScores = {
    scores: Object.fromEntries(
      crews.map((c) => [c.id, { purchases: 0, entries: 0 } as CrewScore]),
    ),
    summary: {
      ok: false,
      fromBlock: null,
      toBlock: null,
      capped: false,
      skippedSpans: 0,
      scannedAt: Date.now(),
    },
  };
  if (crews.length === 0) {
    empty.summary.ok = true;
    return empty;
  }

  // Crew → set of addresses whose purchases count for it.
  const crewTargets = new Map<string, Set<string>>();
  // Address → crewIds (an address can only belong to one crew, but keep it general).
  const addressToCrew = new Map<string, string>();
  for (const crew of crews) {
    const members = await listCrewMembers(crew.id);
    const memberAddresses = members
      .filter((m) => m.seatStatus === 'active')
      .map((m) => m.memberAddress);
    const targets = targetAddressesForCrew(crew, memberAddresses);
    crewTargets.set(crew.id, targets);
    for (const addr of targets) addressToCrew.set(addr, crew.id);
  }

  if (addressToCrew.size === 0) {
    empty.summary.ok = true;
    empty.summary.error = 'No tracked member addresses yet';
    return empty;
  }

  const client = getBaseClientForChain(season.chainId);
  let toBlock: bigint;
  try {
    const head = await client.getBlockNumber();
    if (season.drawWindowEnd > 0) {
      const endBlock = await blockForTimestamp(client, Math.floor(season.drawWindowEnd / 1000));
      toBlock = endBlock !== null && endBlock < head ? endBlock : head;
    } else {
      toBlock = head;
    }
  } catch (error) {
    empty.summary.error = `Chain head lookup failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.warn('[season-scoring] head lookup failed', { chainId: season.chainId });
    return empty;
  }

  let fromBlock: bigint;
  let capped = false;
  const minFrom = toBlock > BigInt(MAX_SCAN_BLOCKS) ? toBlock - BigInt(MAX_SCAN_BLOCKS) : 0n;
  if (season.drawWindowStart > 0) {
    const startBlock = await blockForTimestamp(client, Math.floor(season.drawWindowStart / 1000));
    if (startBlock === null || startBlock < minFrom) {
      fromBlock = minFrom;
      capped = true;
    } else {
      fromBlock = startBlock;
    }
  } else {
    fromBlock = minFrom;
    capped = toBlock >= BigInt(MAX_SCAN_BLOCKS);
  }

  const megapotAddresses = getMegapotAddressesForChain(season.chainId);
  const scores: Record<string, CrewScore> = Object.fromEntries(
    crews.map((c) => [c.id, { purchases: 0, entries: 0 } as CrewScore]),
  );
  let skippedSpans = 0;

  const credit = (address: string | undefined, entries: number) => {
    if (!address) return;
    const crewId = addressToCrew.get(address.toLowerCase());
    if (!crewId) return;
    scores[crewId].purchases += 1;
    scores[crewId].entries += entries;
  };

  for (let spanStart = fromBlock; spanStart <= toBlock; spanStart += SPAN) {
    const spanEnd = spanStart + SPAN - 1n > toBlock ? toBlock : spanStart + SPAN - 1n;

    // All known Megapot addresses for one span in parallel.
    const results = await Promise.all(
      megapotAddresses.map(async (address) => {
        try {
          const logs = (await client.getLogs({
            address,
            fromBlock: spanStart,
            toBlock: spanEnd,
          })) as unknown as Log[];
          return { logs, failed: false };
        } catch (error) {
          logger.debug('[season-scoring] span skipped', {
            address,
            from: String(spanStart),
            message: error instanceof Error ? error.message : String(error),
          });
          return { logs: [] as Log[], failed: true };
        }
      }),
    );

    // Combine this span's logs across all Megapot addresses, then decode each
    // event family in priority order. One purchase transaction can emit both an
    // RTB summary event and per-ticket jackpot events, so credit each tx once.
    const spanLogs: Log[] = [];
    for (const { logs, failed } of results) {
      if (failed) {
        skippedSpans += 1;
        continue;
      }
      spanLogs.push(...logs);
    }

    const creditedTxHashes = new Set<string>();
    const txKey = (log: unknown): string =>
      (log as { transactionHash?: string }).transactionHash ?? '';
    // Only dedupe on a real tx hash; mocked test logs may omit it.
    const claim = (log: unknown): boolean => {
      const k = txKey(log);
      if (!k) return true;
      if (creditedTxHashes.has(k)) return false;
      creditedTxHashes.add(k);
      return true;
    };

    // Live V2 (mainnet): one RandomTicketsBought per purchase transaction.
    try {
      const decoded = parseEventLogs({ abi: [RANDOM_TICKETS_BOUGHT], logs: spanLogs });
      for (const log of decoded) {
        if (!claim(log)) continue;
        credit(log.args.recipient as string | undefined, Number(log.args.count ?? 0n));
      }
    } catch {
      /* mixed logs — ignore undecodable */
    }

    // Live V2 (mainnet): one TicketPurchased event per ticket; group by tx.
    try {
      const decoded = parseEventLogs({ abi: [TICKET_PURCHASED_LIVE_V2], logs: spanLogs });
      const perTx = new Map<string, { recipient: string | undefined; count: number }>();
      for (const log of decoded) {
        const k = txKey(log);
        if (k && creditedTxHashes.has(k)) continue;
        const entry = perTx.get(k) ?? {
          recipient: log.args.recipient as string | undefined,
          count: 0,
        };
        entry.count += 1;
        perTx.set(k, entry);
      }
      for (const [k, entry] of perTx) {
        if (k) creditedTxHashes.add(k);
        credit(entry.recipient, entry.count);
      }
    } catch {
      /* mixed logs — ignore undecodable */
    }

    // Legacy V2 events
    try {
      const decoded = parseEventLogs({ abi: [TICKET_PURCHASED_V2], logs: spanLogs });
      for (const log of decoded) {
        if (!claim(log)) continue;
        credit(log.args.buyer, Number(log.args.ticketCount ?? 0n));
      }
    } catch {
      /* mixed logs — ignore undecodable */
    }

    // Classic events
    try {
      const decoded = parseEventLogs({ abi: [USER_TICKET_PURCHASE], logs: spanLogs });
      for (const log of decoded) {
        if (!claim(log)) continue;
        credit(
          log.args.buyer,
          Number(log.args.ticketsPurchasedTotalBps ?? 0n) / 10_000,
        );
      }
    } catch {
      /* mixed logs — ignore undecodable */
    }
  }

  const result: SeasonScores = {
    scores,
    summary: {
      ok: true,
      fromBlock: String(fromBlock),
      toBlock: String(toBlock),
      capped,
      skippedSpans,
      scannedAt: Date.now(),
    },
  };
  cache.set(cacheKey, { at: Date.now(), result });
  logger.info('[season-scoring] scored', {
    seasonId: season.id,
    crews: crews.length,
    fromBlock: String(fromBlock),
    toBlock: String(toBlock),
    skippedSpans,
  });
  return result;
}
