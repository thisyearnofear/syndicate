import type { AgentSessionMemory } from '../tools/types';

function newSessionId(): string {
  return `xlayer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAgentSessionMemory(): AgentSessionMemory {
  return {
    sessionId: newSessionId(),
    updatedAt: Date.now(),
    lastPlanId: null,
    lastRecommendationAction: null,
    lastTxHash: null,
    epochId: null,
    demoOracleValue: null,
    pendingStepIds: [],
    history: [],
  };
}

export function rememberPlan(
  memory: AgentSessionMemory,
  planId: string,
  action: string | null,
  pendingStepIds: string[],
  epochId: number | null,
  demoOracleValue: string | null,
): AgentSessionMemory {
  return {
    ...memory,
    updatedAt: Date.now(),
    lastPlanId: planId,
    lastRecommendationAction: action,
    pendingStepIds,
    epochId: epochId ?? memory.epochId,
    demoOracleValue: demoOracleValue ?? memory.demoOracleValue,
    history: [
      ...memory.history.slice(-19),
      { at: Date.now(), kind: 'plan', detail: `Plan ${planId} · action=${action ?? 'wait'}` },
    ],
  };
}

export function rememberDecision(
  memory: AgentSessionMemory,
  kind: 'approve' | 'reject',
  stepId: string,
  toolId: string,
): AgentSessionMemory {
  const pending =
    kind === 'reject'
      ? memory.pendingStepIds.filter((id) => id !== stepId)
      : memory.pendingStepIds;
  return {
    ...memory,
    updatedAt: Date.now(),
    pendingStepIds: pending,
    history: [
      ...memory.history.slice(-19),
      { at: Date.now(), kind, detail: `${kind} ${toolId} (${stepId.slice(0, 8)})` },
    ],
  };
}

export function rememberObservation(
  memory: AgentSessionMemory,
  stepId: string,
  toolId: string,
  ok: boolean,
  txHash?: string,
  demoOracleValue?: string | null,
  epochId?: number | null,
): AgentSessionMemory {
  return {
    ...memory,
    updatedAt: Date.now(),
    lastTxHash: txHash ?? memory.lastTxHash,
    demoOracleValue:
      demoOracleValue !== undefined ? demoOracleValue : memory.demoOracleValue,
    epochId: epochId !== undefined && epochId !== null ? epochId : memory.epochId,
    pendingStepIds: memory.pendingStepIds.filter((id) => id !== stepId),
    history: [
      ...memory.history.slice(-19),
      {
        at: Date.now(),
        kind: 'observe',
        detail: `${ok ? 'ok' : 'fail'} ${toolId}`,
        txHash,
      },
    ],
  };
}
