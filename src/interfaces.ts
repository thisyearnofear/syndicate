// Shared interfaces used across UI components
// DRY: Single source of truth for common interface types

import type { MemoryIdentity } from '@/services/socialService';

export type UserIdentity = MemoryIdentity;

export interface CommunityInsight {
  icon: string;
  title: string;
  description: string;
  color: string;
}

// Social Feed Interfaces
export interface SyndicateActivity {
  id: string;
  type: 'purchase' | 'win' | 'join' | 'share';
  userId: string;
  syndicateId: string;
  timestamp: Date;
  metadata: {
    amount?: number;
    tickets?: number;
    cause?: string;
    message?: string;
  };
}

// Advanced Permission Interfaces
export interface AdvancedPermission {
  id: string;
  permissionId: string;
  scope: string;
  tokenAddress: string;
  limit: bigint;
  period: 'daily' | 'weekly' | 'monthly';
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface AdvancedPermissionGrant {
  permission: AdvancedPermission;
  frequency: 'daily' | 'weekly' | 'monthly';
  amountPerPeriod: bigint;
  ticketCount: number;
  nextExecution: number;
}

// Auto Purchase Configuration
export interface AutoPurchaseConfig {
  enabled: boolean;
  permission: AdvancedPermission;
  frequency: 'daily' | 'weekly' | 'monthly';
  amountPerPeriod: bigint;
  tokenAddress: string;
  lastExecuted?: Date;
  nextExecution: number;
}

// Cross Chain Purchase Interface
export interface CrossChainPurchase {
  id: string;
  sourceChain: string;
  sourceTxId: string;
  baseTxId?: string;
  amount: number;
  ticketCount: number;
  status: 'pending' | 'confirmed' | 'bridged' | 'purchased' | 'failed';
  timestamp: Date;
}
