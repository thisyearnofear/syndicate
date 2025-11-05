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
// SYNDICATE TYPES (ENHANCEMENT FIRST: Added to existing lottery types)
// =============================================================================

export interface SyndicateInfo {
  id: string;
  name: string;
  cause: {
    id: string;
    name: string;
    verifiedWallet: string;    // Transparent cause wallet
    description: string;
    verificationSource: 'gitcoin' | 'coinlist' | 'community' | 'manual'; // Verification source
    verificationScore: number; // 0-100 based on multiple verification factors
    verificationTimestamp: Date; // When verification occurred
    verificationTier: 1 | 2 | 3; // Verification tier (1=automatic, 2=community, 3=nominated)
  };
  description: string;
  causePercentage: number;
  governanceModel: 'leader' | 'dao' | 'hybrid';  // Governance choice
  governanceParameters?: {
    // Leader-guided parameters
    maxFundAction?: number;      // Max % of funds leader can move without DAO approval
    actionTimeLimit?: number;    // Time window for leader actions
    
    // DAO parameters
    quorumPercentage?: number;   // Minimum participation for DAO decisions
    executionDelay?: number;     // Time lock for DAO-executed actions
    
    // Hybrid parameters
    thresholdAmount?: number;    // Amount above which DAO approval required
    emergencySwitch?: boolean;   // Allow temporary leader control in emergencies
  };
  // Yield allocation preferences
  yieldToTicketsPercentage?: number;  // 80-90% of yield used to buy more tickets
  yieldToCausesPercentage?: number;   // 10-20% of yield directly funds causes
  vaultStrategy?: 'spark' | 'morpho' | 'octant' | 'aave' | 'uniswap';
  membersCount: number;
  ticketsPooled: number;
  totalImpact: number;
  isActive: boolean;
  isTrending: boolean;
  recentActivity: SyndicateActivity[];
}

export interface VerifiedCause {
  id: string;
  name: string;
  walletAddress: string;
  verificationSource: 'gitcoin' | 'coinlist' | 'community' | 'manual';
  verificationTimestamp: Date;
  verificationScore: number; // 0-100 based on multiple verification factors
  verificationTier: 1 | 2 | 3; // 1=auto, 2=community, 3=nominated
  impactMetrics?: ImpactMetric[]; // Track actual impact
}

export interface ImpactMetric {
  metricType: 'fundsDistributed' | 'impactReported' | 'verificationUpdated';
  value: number | string;
  timestamp: Date;
  source: string; // Source of the impact metric
}

export interface SyndicateActivity {
  type: 'join' | 'tickets' | 'win' | 'donation' | 'yield';
  count: number;
  timeframe: string;
  amount?: number;
}

export interface PurchaseOptions {
  ticketCount: number;
  mode: 'individual' | 'syndicate';
  syndicateId?: string;
}

export interface SyndicateImpact {
  syndicateId: string;
  syndicate: SyndicateInfo;
  ticketsPurchased: number;
  potentialCauseAmount: number;
  membershipStatus: 'new' | 'existing';
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type LotteryError = {
  code: 'NETWORK_ERROR' | 'CONTRACT_ERROR' | 'USER_REJECTED' | 'INSUFFICIENT_FUNDS' | 'SYNDICATE_ERROR' | 'UNKNOWN';
  message: string;
  details?: any;
};

export type PurchaseResult = {
  success: boolean;
  txHash?: string;
  error?: LotteryError;
  // ENHANCEMENT: Added syndicate fields
  syndicateId?: string;
  syndicateImpact?: SyndicateImpact;
  mode?: 'individual' | 'syndicate';
  // NEW: Yield strategy fields
  vaultStrategy?: 'spark' | 'morpho' | 'octant' | 'aave' | 'uniswap';
  yieldToTicketsPercentage?: number;
  yieldToCausesPercentage?: number;
};