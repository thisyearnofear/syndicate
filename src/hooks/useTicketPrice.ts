/**
 * useTicketPrice — the live Megapot ticket price, for payout previews.
 *
 * Extracted from SettlePotPanel so the Call-the-Pot and bid surfaces can show
 * the player what an offer actually pays *before* they commit, instead of
 * asking them to do the arithmetic themselves. Same read, one place.
 *
 * Falls back to $1 when the read fails, and reports `resolved` so callers can
 * mark a preview as approximate rather than presenting a fallback as fact.
 */

import { useEffect, useState } from 'react';
import { web3Service } from '@/services/web3Service';

const FALLBACK_TICKET_PRICE = 1;

export interface UseTicketPriceResult {
  ticketPrice: number;
  /** True once a real on-chain price has been read. */
  resolved: boolean;
}

export function useTicketPrice(): UseTicketPriceResult {
  const [ticketPrice, setTicketPrice] = useState(FALLBACK_TICKET_PRICE);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let active = true;
    web3Service
      .getTicketPrice()
      .then((value) => {
        const parsed = Number(value);
        if (active && Number.isFinite(parsed) && parsed > 0) {
          setTicketPrice(parsed);
          setResolved(true);
        }
      })
      .catch(() => {
        /* keep the $1 fallback; `resolved` stays false so callers hedge */
      });
    return () => {
      active = false;
    };
  }, []);

  return { ticketPrice, resolved };
}
