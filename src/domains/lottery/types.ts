/**
 * LOTTERY DOMAIN TYPES
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for lottery types
 * - CLEAN: Clear type definitions with documentation
 * - MODULAR: Composable type definitions
 */

// =============================================================================
// MEGAPOT API TYPES
// =============================================================================

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

// =============================================================================
// UI STATE TYPES
// =============================================================================

export interface LotteryState {
  jackpotStats: JackpotStats | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

export interface TicketPurchaseState {
  isPurchasing: boolean;
  isApproving: boolean;
  error: string | null;
  txHash: string | null;
}

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

export interface JackpotDisplayProps {
  stats: JackpotStats | null;
  isLoading?: boolean;
  onBuyClick?: () => void;
  className?: string;
}

export interface TicketPurchaseProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (txHash: string) => void;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type LotteryError = {
  code: 'NETWORK_ERROR' | 'CONTRACT_ERROR' | 'USER_REJECTED' | 'INSUFFICIENT_FUNDS' | 'UNKNOWN';
  message: string;
  details?: any;
};

export type PurchaseResult = {
  success: boolean;
  txHash?: string;
  error?: LotteryError;
};