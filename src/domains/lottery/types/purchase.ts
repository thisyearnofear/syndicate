/**
 * PURCHASE DOMAIN TYPES
 *
 * Single source of truth for all purchase-related types.
 * DRY: No duplicate type definitions across handlers.
 */

import type { VaultProtocol } from "@/services/vaults/vaultProvider";

// =============================================================================
// CORE TYPES
// =============================================================================

export type PurchaseChain =
  | "base"
  | "near"
  | "solana"
  | "stacks"
  | "ethereum"
  | "starknet";

export type PurchaseMode = "direct" | "syndicate" | "vault";

export type PurchaseStatus =
  | "pending_signature"
  | "bridging"
  | "complete"
  | "failed"
  | "awaiting_deposit";

export type PurchaseStage =
  | "connecting"
  | "checking-balance"
  | "approving"
  | "bridging"
  | "executing"
  | "confirming";

// =============================================================================
// REQUEST / RESULT
// =============================================================================

export interface PurchaseRequest {
  /** User's wallet address on the source chain */
  userAddress: string;

  /** Chain to purchase from */
  chain: PurchaseChain;

  /** Number of tickets to purchase */
  ticketCount: number;

  /** Purchase mode: direct, syndicate, or vault */
  mode?: PurchaseMode;

  /** For syndicate purchases: pool ID */
  syndicatePoolId?: string;

  /** For vault purchases: vault protocol and amount */
  vaultProtocol?: VaultProtocol;
  vaultAmount?: string;

  /** For cross-chain: where to receive tickets (defaults to userAddress on Base) */
  recipientAddress?: string;

  /** Advanced Permissions mode (no user signature needed) */
  permissionId?: string;

  /** For Stacks: which token to use */
  stacksTokenPrincipal?: string;

  /** For Starknet: which token to use */
  starknetTokenAddress?: string;

  /** For resuming after wallet signature */
  resume?: {
    bridgeId: string;
    sourceTxHash: string;
  };
}

export interface PurchaseResult {
  success: boolean;
  txHash?: string;
  status?: PurchaseStatus;
  bridgeId?: string;
  details?: Record<string, unknown>;
  sourceTxHash?: string;
  destinationTxHash?: string;
  stages?: PurchaseStage[];
  error?: {
    code: string;
    message: string;
    suggestedAction?: string;
  };
}

export interface PurchaseProgress {
  stage: PurchaseStage;
  progress: number; // 0-100
  message: string;
  txHash?: string;
}
