/**
 * Human-readable labels and formatting for Season feed events.
 * Shared by the /season page and the /syndicate Season overlay so the
 * story reads identically everywhere.
 */

import type { SeasonEvent } from './types';

function shortAddr(a: string): string {
  if (!a || a.length < 10) return 'Someone';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function eventLabel(ev: SeasonEvent): string {
  const p = ev.payload as Record<string, unknown>;
  switch (ev.kind) {
    case 'season.created':
      return 'The season is live — crews can now form';
    case 'crew.created':
      return `Crew "${String(p.name ?? 'unknown')}" founded`;
    case 'seat.taken':
      return `${shortAddr(String(p.address ?? ''))} took a seat at the table`;
    case 'seat.freed':
      return 'A seat freed — every remaining cut just grew';
    case 'bid.placed':
      return `${shortAddr(String(p.bidder ?? ''))} offered ${((Number(p.discountBps) || 0) / 100).toFixed(1)}% back to the crew`;
    case 'round.opened':
      return 'The pot was called — the auction is live';
    case 'round.settled':
      return 'Pot settled on-chain — the winner exits, the survivors are fed';
    case 'round.expired':
      return 'Auction closed with no settlement — the chest rolls on';
    case 'settle.rejected':
      return 'Settlement attempt rejected — receipts did not verify';
    default:
      return ev.kind;
  }
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export { shortAddr };
