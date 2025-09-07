// Megapot API service
// Based on https://docs.megapot.io/developers/developer-reference/megapot-api

import { MEGAPOT_API_BASE_URL, MEGAPOT_API_KEY, MEGAPOT_ENDPOINTS } from '@/lib/megapot-constants';

export interface JackpotStats {
  prizeUsd: string;
  endTimestamp: string;
  oddsPerTicket: string;
  ticketPrice: number;
  ticketsSoldCount: number;
  lastTicketPurchaseBlockNumber: number;
  lastTicketPurchaseCount: number;
  lastTicketPurchaseTimestamp: string;
  lastTicketPurchaseTxHash: string;
  lpPoolTotalBps: string;
  userPoolTotalBps: string;
  feeBps: number;
  referralFeeBps: number;
  activeLps: number;
  activePlayers: number;
}

export interface TicketPurchase {
  jackpotRoundId: number;
  recipient: string;
  referrer: string;
  buyer: string;
  transactionHashes: string[];
  ticketsPurchasedTotalBps: number;
  ticketsPurchased: number;
  startTicket: number;
  endTicket: number;
}

export interface DailyGiveawayWin {
  jackpotRoundId: number;
  claimTransactionHashes: string[];
  claimedAt: string;
  drawingBlockNumber: number;
  prizeValueTotal: number;
}

class MegapotService {
  private baseUrl = MEGAPOT_API_BASE_URL;
  private apiKey = MEGAPOT_API_KEY;

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key to headers if available
    if (this.apiKey) {
      headers['apikey'] = this.apiKey;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching from Megapot API: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Get current active jackpot stats
   * Highly performant - cached and updated per minute
   */
  async getActiveJackpotStats(): Promise<JackpotStats> {
    return this.makeRequest<JackpotStats>(MEGAPOT_ENDPOINTS.ACTIVE_JACKPOT);
  }

  /**
   * Get user's ticket purchase history
   */
  async getUserTicketPurchases(walletAddress: string): Promise<TicketPurchase[]> {
    return this.makeRequest<TicketPurchase[]>(`${MEGAPOT_ENDPOINTS.TICKET_PURCHASES}/${walletAddress}`);
  }

  /**
   * Get user's daily giveaway win history
   */
  async getUserDailyGiveawayWins(walletAddress: string): Promise<Record<string, DailyGiveawayWin>> {
    return this.makeRequest<Record<string, DailyGiveawayWin>>(`${MEGAPOT_ENDPOINTS.DAILY_GIVEAWAY_WINNERS}/${walletAddress}`);
  }

  /**
   * Calculate odds for a given number of tickets
   */
  calculateOdds(oddsPerTicket: number, numberOfTickets: number): number {
    return Math.floor(oddsPerTicket / numberOfTickets);
  }

  /**
   * Format USDC amount from basis points
   */
  formatUsdcFromBps(bps: string | number): string {
    const amount = typeof bps === 'string' ? parseInt(bps) : bps;
    return (amount / 1000000).toFixed(2);
  }

  /**
   * Format timestamp to readable date
   */
  formatTimestamp(timestamp: string): Date {
    return new Date(parseInt(timestamp));
  }

  /**
   * Check if jackpot is active (not ended)
   */
  isJackpotActive(endTimestamp: string): boolean {
    const endTime = this.formatTimestamp(endTimestamp);
    return endTime.getTime() > Date.now();
  }

  /**
   * Get time remaining until jackpot ends
   */
  getTimeRemaining(endTimestamp: string): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } {
    const endTime = this.formatTimestamp(endTimestamp);
    const now = Date.now();
    const difference = endTime.getTime() - now;

    if (difference <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
      };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return {
      days,
      hours,
      minutes,
      seconds,
      isExpired: false,
    };
  }
}

export const megapotService = new MegapotService();