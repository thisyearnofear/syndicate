/**
 * Agent tool primitives — typed tools with capability, HITL, and receipt gates.
 *
 * Principles:
 *   - Tools are the only way agents propose side effects
 *   - User-approved policy / explicit HITL remains the auth boundary
 *   - Receipt-required tools never report success without a confirmed tx
 *   - Capability registry gates availability; tools do not bypass it
 */

import type { CapabilityId } from '@/config/capabilities';

export type AgentChain = 'xlayer_testnet';

export type XLayerToolId =
  | 'xlayer.getPoolState'
  | 'xlayer.recommendSurcharge'
  | 'xlayer.openDraw'
  | 'xlayer.setDemoOracle'
  | 'xlayer.fulfillRandomness'
  | 'xlayer.claimPrize';

export type AgentToolId = XLayerToolId;

export type AgentToolCallStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed';

export interface AgentToolDefinition {
  id: AgentToolId;
  label: string;
  description: string;
  /** Capability that must allow reads (and writes when not readOnly). */
  capabilityId: CapabilityId;
  chains: AgentChain[];
  /** User must explicitly approve before execute. */
  requiresHitl: boolean;
  /** Success requires a verified on-chain receipt. */
  requiresReceipt: boolean;
  /** No chain mutation — may auto-run after plan when HITL not required. */
  readOnly: boolean;
}

export interface AgentToolResult {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
  transactionHash?: string;
  /** True only when requiresReceipt tools have a confirmed receipt. */
  receiptConfirmed?: boolean;
}

export interface AgentToolCall {
  id: string;
  toolId: AgentToolId;
  args: Record<string, unknown>;
  status: AgentToolCallStatus;
  result?: AgentToolResult;
  error?: string;
  proposedAt: number;
  decidedAt?: number;
  completedAt?: number;
}

export interface AgentPlan {
  id: string;
  chain: AgentChain;
  rationale: string[];
  warnings: string[];
  source: 'venice' | 'heuristic';
  steps: AgentToolCall[];
  createdAt: number;
}

export interface AgentSessionMemory {
  sessionId: string;
  updatedAt: number;
  lastPlanId: string | null;
  lastRecommendationAction: string | null;
  lastTxHash: string | null;
  epochId: number | null;
  demoOracleValue: string | null;
  pendingStepIds: string[];
  history: Array<{
    at: number;
    kind: 'plan' | 'approve' | 'reject' | 'execute' | 'observe';
    detail: string;
    txHash?: string;
  }>;
}

export interface AgentLoopState {
  status: 'idle' | 'planning' | 'awaiting_hitl' | 'executing' | 'observing' | 'error';
  plan: AgentPlan | null;
  memory: AgentSessionMemory;
  error: string | null;
}
