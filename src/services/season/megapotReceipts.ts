/**
 * SEASON — MEGAPOT RECEIPT VERIFICATION + ENTRY SCORING
 *
 * Verifies real ticket-purchase receipts on the season's own chain before
 * any settlement state is recorded, and scores crew entries from on-chain
 * purchase events. Two contract generations emit two event shapes, so both
 * are tried:
 *
 * - V2 jackpot (0x3bAe…42a2 mainnet): `TicketPurchased(buyer indexed,
 *   ticketCount, referralFeePaid)` — what /api/activity/recent already reads.
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
import { getBaseClientForChain } from '@/lib/baseClient';
import { getMegapotAddressForChain, CHAIN_IDS } from '@/config/index';
import { MEGAPOT_V2 } from '@/config/contracts';
import { logger } from '@/lib/logger';

const TICKET_PURCHASED_V2 = parseAbiItem(
  'event TicketPurchased(address indexed buyer, uint256 ticketCount, uint256 referralFeePaid)',
);

const USER_TICKET_PURCHASE = parseAbiItem(
  'event UserTicketPurchase(address indexed recipient, uint256 ticketsPurchasedTotalBps, address indexed referrer, address indexed buyer)',
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
  const client = getBaseClientForChain(chainId);
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

  // Try the V2 TicketPurchased shape.
  try {
    const decoded = parseEventLogs({ abi: [TICKET_PURCHASED_V2], logs: megapotLogs });
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
