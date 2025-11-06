/**
 * SYNDICATE DOMAIN TYPES
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for syndicate types
 * - CLEAN: Clear type definitions
 */

export interface SyndicatePool {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  totalTickets: number;
  causeAllocation: number;
  isActive: boolean;
}

export interface SyndicateMember {
  address: string;
  ticketCount: number;
  joinedAt: Date;
}
