/**
 * SEASON — MEGAPOT RECEIPT VERIFICATION + ENTRY SCORING
 *
 * Verifies real ticket-purchase receipts on the season's own chain before
 * any settlement state is recorded, and scores crew entries from on-chain
 * purchase events. Three contract generations emit different event shapes,
 * all of which are tried:
 *
 * - Live V2 mainnet (jackpot 0x3bAe…42a2 + RandomTicketBuyer 0xb956…3aBd):
 *   `TicketPurchased(recipient indexed, currentDrawingId indexed,
 *   source indexed, userTicketId, normals[], bonusball, ticketHash)` (one per
 *   ticket), `TicketOrderProcessed(caller indexed, recipient indexed,
 *   currentDrawingId indexed, numberOfTickets, lpEarnings, referralFees)` and
 *   `RandomTicketsBought(recipient indexed, drawingId indexed, count, cost,
 *   ticketIds[])` — shapes verified against the 2026-08-14 mainnet receipts.
 * - Classic/sepolia (0x6f03…5De sepolia, 0xbEDd…1B95 mainnet):
 *   `UserTicketPurchase(recipient indexed, ticketsPurchasedTotalBps,
 *   referrer indexed, buyer indexed)` — what the indexer tracks; the
 *   indexed referrer is the hook for quick-crew scoring.
 *
 * Receipts are only accepted when: tx succeeded, the emitting contract is a
 * known Megapot address for that chain, and the purchase attribution
 * (buyer or recipient) matches the expected address. Nothing is simulated.
 */

import { parseAbiItem, parseEventLogs, type Log } from 'viem';
import { getBaseClientForChain, getBaseReceiptClientForChain } from '@/lib/baseClient';
import { getMegapotAddressForChain, CHAIN_IDS } from '@/config/index';
import { MEGAPOT_V2 } from '@/config/contracts';
import { logger } from '@/lib/logger';

const TICKET_PURCHASED_V2_LEGACY = parseAbiItem(
  'event TicketPurchased(address indexed buyer, uint256 ticketCount, uint256 referralFeePaid)',
);

const USER_TICKET_PURCHASE = parseAbiItem(
  'event UserTicketPurchase(address indexed recipient, uint256 ticketsPurchasedTotalBps, address indexed referrer, address indexed buyer)',
);

/**
 * Live mainnet V2 shapes (verified against the 2026-08-14 mainnet receipts
 * 0x5439…09ef5c and 0xbac9…72f4 and the official ABIs at llms.megapot.io):
 * the jackpot emits one TicketPurchased event PER TICKET, one
 * TicketOrderProcessed per order, and the RandomTicketBuyer emits one
 * RandomTicketsBought per order. The ticket holder is always the first
 * indexed address (recipient), except TicketOrderProcessed where the caller
 * (the RTB contract) is first and the recipient second.
 */
const TICKET_PURCHASED_LIVE_V2 = parseAbiItem(
  'event TicketPurchased(address indexed recipient, uint256 indexed currentDrawingId, bytes32 indexed source, uint256 userTicketId, uint8[] normals, uint8 bonusball, bytes32 ticketHash)',
);

const TICKET_ORDER_PROCESSED = parseAbiItem(
  'event TicketOrderProcessed(address indexed caller, address indexed recipient, uint256 indexed currentDrawingId, uint256 numberOfTickets, uint256 lpEarnings, uint256 referralFees)',
);

const RANDOM_TICKETS_BOUGHT = parseAbiItem(
  'event RandomTicketsBought(address indexed recipient, uint256 indexed drawingId, uint256 count, uint256 cost, uint256[] ticketIds)',
);

/** Known Megapot contract addresses for a chain (allowlist for log emitters). */
export function getMegapotAddressesForChain(chainId: number): `0x${string}`[] {
  const addresses = new Set<`0x${string}`>();
  addresses.add(getMegapotAddressForChain(chainId));
  if (chainId === CHAIN_IDS.BASE) {
    // V2 suite (mainnet) — jackpot and the random-ticket buyer both emit
    // purchase events depending on the entry path used.
    addresses.add(MEGAPOT_V2.jackpot.address);
    addresses.add(MEGAPOT_V2.randomTicketBuyer.address);
    // The address the indexer tracks (classic generation).
    addresses.add('0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95');
  }
  return [...addresses];
}

export interface VerifiedPurchase {
  ok: boolean;
  reason?: string;
  txHash?: string;
  /** Attributed buyer of the tickets (v2: buyer; classic: recipient). */
  buyer?: string;
  referrer?: string | null;
  ticketCount?: number;
}

/**
 * Verify that a transaction is a real Megapot ticket purchase attributing
 * tickets to `expectedBuyer`. Returns ok:false with a reason instead of
 * throwing, so callers can journal explicit failures.
 */
export async function verifyTicketPurchaseReceipt(params: {
  chainId: number;
  txHash: `0x${string}`;
  expectedBuyer: `0x${string}`;
}): Promise<VerifiedPurchase> {
  const { chainId, txHash, expectedBuyer } = params;
  // Single-object receipt lookups go through the dedicated receipt client
  // (Alchemy when configured) — public RPCs have proven unreliable for
  // getTransactionReceipt. Wide getLogs scans elsewhere stay on the public
  // client because the Alchemy free tier caps eth_getLogs at 10-block ranges.
  const client = getBaseReceiptClientForChain(chainId);
  const allowed = new Set(getMegapotAddressesForChain(chainId).map((a) => a.toLowerCase()));

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `Receipt lookup failed: ${message}` };
  }

  if (receipt.status !== 'success') {
    return { ok: false, reason: 'Transaction reverted or failed on-chain.' };
  }

  const megapotLogs = receipt.logs.filter((log) => allowed.has(log.address.toLowerCase()));
  if (megapotLogs.length === 0) {
    return { ok: false, reason: 'No logs from a known Megapot contract in this transaction.' };
  }

  const expected = expectedBuyer.toLowerCase();

  // Try the classic UserTicketPurchase first (richer attribution + referrer).
  try {
    const decoded = parseEventLogs({ abi: [USER_TICKET_PURCHASE], logs: megapotLogs });
    for (const d of decoded) {
      const recipient = d.args.recipient?.toLowerCase();
      const buyer = d.args.buyer?.toLowerCase();
      if (recipient === expected || buyer === expected) {
        return {
          ok: true,
          txHash,
          buyer: d.args.recipient,
          referrer: d.args.referrer ?? null,
          ticketCount: Number(d.args.ticketsPurchasedTotalBps ?? 0n) / 10_000,
        };
      }
    }
  } catch {
    /* fall through to v2 shape */
  }

  // Try the live mainnet V2 shapes (RandomTicketBuyer path).
  try {
    const bought = parseEventLogs({ abi: [RANDOM_TICKETS_BOUGHT], logs: megapotLogs });
    for (const d of bought) {
      if (d.args.recipient?.toLowerCase() === expected) {
        return {
          ok: true,
          txHash,
          buyer: d.args.recipient,
          referrer: null,
          ticketCount: Number(d.args.count ?? 0n),
        };
      }
    }

    const processed = parseEventLogs({ abi: [TICKET_ORDER_PROCESSED], logs: megapotLogs });
    for (const d of processed) {
      if (d.args.recipient?.toLowerCase() === expected) {
        return {
          ok: true,
          txHash,
          buyer: d.args.recipient,
          referrer: null,
          ticketCount: Number(d.args.numberOfTickets ?? 0n),
        };
      }
    }

    // One TicketPurchased event per ticket — count the matches.
    const purchased = parseEventLogs({ abi: [TICKET_PURCHASED_LIVE_V2], logs: megapotLogs });
    const matching = purchased.filter((d) => d.args.recipient?.toLowerCase() === expected);
    if (matching.length > 0) {
      return {
        ok: true,
        txHash,
        buyer: matching[0].args.recipient,
        referrer: null,
        ticketCount: matching.length,
      };
    }
  } catch {
    /* no decodable live V2 purchase event */
  }

  // Try the legacy V2 TicketPurchased shape.
  try {
    const decoded = parseEventLogs({ abi: [TICKET_PURCHASED_V2_LEGACY], logs: megapotLogs });
    for (const d of decoded) {
      if (d.args.buyer?.toLowerCase() === expected) {
        return {
          ok: true,
          txHash,
          buyer: d.args.buyer,
          referrer: null,
          ticketCount: Number(d.args.ticketCount ?? 0n),
        };
      }
    }
  } catch {
    /* no decodable purchase event */
  }

  return {
    ok: false,
    reason: `Megapot logs present but no purchase attributed to ${expectedBuyer}.`,
  };
}

/**
 * Score helper: count real Megapot entries whose on-chain referrer equals
 * the given address (the quick-crew referrer path). Walks the block window
 * in small spans because public RPCs cap getLogs ranges. Best-effort: a
 * span rejected by the RPC is skipped, never faked.
 */
export async function countEntriesForReferrer(params: {
  chainId: number;
  referrer: `0x${string}`;
  fromBlock?: bigint;
  toBlock?: bigint;
  maxBlocks?: number;
}): Promise<{ tickets: number; purchases: number }> {
  const { chainId, referrer, maxBlocks = 10_000 } = params;
  const client = getBaseClientForChain(chainId);
  const referrerLower = referrer.toLowerCase();

  const head = await client.getBlockNumber();
  const toBlock = params.toBlock ?? head;
  const fromBlock =
    params.fromBlock ?? (toBlock > BigInt(maxBlocks) ? toBlock - BigInt(maxBlocks) : 0n);

  const addresses = getMegapotAddressesForChain(chainId);

  let tickets = 0;
  let purchases = 0;
  const span = 2_000n;

  for (let start = fromBlock; start <= toBlock; start += span) {
    const end = start + span - 1n > toBlock ? toBlock : start + span - 1n;
    for (const address of addresses) {
      try {
        const rawLogs = (await client.getLogs({
          address,
          fromBlock: start,
          toBlock: end,
        })) as unknown as Log[];
        const decoded = parseEventLogs({ abi: [USER_TICKET_PURCHASE], logs: rawLogs });
        for (const d of decoded) {
          if (d.args.referrer?.toLowerCase() !== referrerLower) continue;
          purchases += 1;
          tickets += Number(d.args.ticketsPurchasedTotalBps ?? 0n) / 10_000;
        }
      } catch {
        // Span rejected by this RPC — skip silently; scoring is best-effort.
        logger.debug('[SeasonScoring] getLogs span skipped', { address, start: String(start) });
      }
    }
  }

  return { tickets, purchases };
}
