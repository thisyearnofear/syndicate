/**
 * Shared types for the Season UI (mirrors the /api/season payload shapes).
 */

export interface SeasonSummary {
  id: string;
  name: string;
  chainId: number;
  drawWindowStart: number;
  drawWindowEnd: number;
  status: 'scheduled' | 'active' | 'closed';
  minChestUsdc: string;
  inactivityDraws: number;
}

export interface CrewSummary {
  id: string;
  seasonId: string;
  name: string;
  crestAccent: string;
  kind: 'quick' | 'syndicate';
  syndicatePoolId: string | null;
  referrerCode: string;
  coordinatorAddress: string;
  activeMembers?: number;
}

export interface CrewMember {
  id: string;
  crewId: string;
  memberAddress: string;
  seatStatus: 'active' | 'freed_exit' | 'freed_inactive';
  joinedAt: string;
  freedAt: string | null;
  cutBps: number;
  joinTxHash: string | null;
}

export interface SeasonEvent {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
