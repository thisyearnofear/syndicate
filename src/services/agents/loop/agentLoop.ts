/**
 * Agent loop — plan → HITL approve → execute → observe.
 *
 * Pure state transitions. Side effects (RPC, wallet, Venice) live in callers.
 */

import { getCapability } from '@/config/capabilities';
import { requireAgentTool } from '../tools/registry';
import { ensureXLayerToolsRegistered, actionToToolId } from '../tools/xlayerTools';
import type {
  AgentLoopState,
  AgentPlan,
  AgentToolCall,
  AgentToolResult,
  AgentSessionMemory,
} from '../tools/types';
import type { XLayerKeeperRecommendation } from '../veniceXLayerKeeper';
import {
  createAgentSessionMemory,
  rememberDecision,
  rememberObservation,
  rememberPlan,
} from '../memory/agentSessionMemory';

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createInitialAgentLoopState(
  memory: AgentSessionMemory = createAgentSessionMemory(),
): AgentLoopState {
  return {
    status: 'idle',
    plan: null,
    memory,
    error: null,
  };
}

export function buildPlanFromKeeperRecommendation(
  recommendation: XLayerKeeperRecommendation,
  poolSnapshot: Record<string, unknown>,
  epochId: number,
): AgentPlan {
  ensureXLayerToolsRegistered();

  const steps: AgentToolCall[] = [];
  const now = Date.now();

  steps.push({
    id: newId('step'),
    toolId: 'xlayer.getPoolState',
    args: { snapshot: poolSnapshot },
    status: 'proposed',
    proposedAt: now,
  });

  steps.push({
    id: newId('step'),
    toolId: 'xlayer.recommendSurcharge',
    args: {
      recommendedSurchargeBps: recommendation.recommendedSurchargeBps,
      surchargeChangeAllowedNow: false,
    },
    status: 'proposed',
    proposedAt: now,
  });

  const actionTool = actionToToolId(recommendation.action);
  if (actionTool) {
    const args: Record<string, unknown> = { epochId };
    if (
      (actionTool === 'xlayer.setDemoOracle' || actionTool === 'xlayer.fulfillRandomness') &&
      recommendation.demoOracleValue
    ) {
      args.value = recommendation.demoOracleValue;
    }
    if (
      (actionTool === 'xlayer.deposit' || actionTool === 'xlayer.fundPot') &&
      recommendation.amountUsdc
    ) {
      args.amountUsdc = recommendation.amountUsdc;
    }
    steps.push({
      id: newId('step'),
      toolId: actionTool,
      args,
      status: 'proposed',
      proposedAt: now,
    });
  }

  return {
    id: newId('plan'),
    chain: 'xlayer_testnet',
    rationale: recommendation.rationale,
    warnings: recommendation.warnings,
    source: recommendation.source,
    steps,
    createdAt: now,
  };
}

export function applyPlan(state: AgentLoopState, plan: AgentPlan): AgentLoopState {
  const hitlPending = plan.steps.some((s) => {
    const def = requireAgentTool(s.toolId);
    return def.requiresHitl;
  });

  return {
    status: hitlPending ? 'awaiting_hitl' : 'observing',
    plan,
    error: null,
    memory: rememberPlan(
      state.memory,
      plan.id,
      plan.steps.find((s) => requireAgentTool(s.toolId).requiresHitl)?.toolId ?? null,
      plan.steps.filter((s) => requireAgentTool(s.toolId).requiresHitl).map((s) => s.id),
      typeof plan.steps.find((s) => s.args.epochId !== undefined)?.args.epochId === 'number'
        ? (plan.steps.find((s) => s.args.epochId !== undefined)!.args.epochId as number)
        : null,
      typeof plan.steps.find((s) => typeof s.args.value === 'string')?.args.value === 'string'
        ? String(plan.steps.find((s) => typeof s.args.value === 'string')!.args.value)
        : null,
    ),
  };
}

export function assertToolAllowed(toolId: AgentToolCall['toolId']): string | null {
  ensureXLayerToolsRegistered();
  const def = requireAgentTool(toolId);
  const cap = getCapability(def.capabilityId);
  if (!cap.readsEnabled) {
    return `${def.label} unavailable: ${cap.availabilityMessage ?? 'reads disabled'}`;
  }
  if (!def.readOnly && def.requiresWriteGate && !cap.writesEnabled) {
    return `${def.label} blocked: enable NEXT_PUBLIC_XLAYER_WRITES_ENABLED for testnet writes.`;
  }
  if (!def.readOnly && !cap.writesEnabled) {
    // Keeper mutations are permissionless on-chain and intentional for the AI Season
    // demo even when deposit writes are gated. Allow HITL tools when the hook is
    // configured (capability reads), but surface a warning via null → caller notes.
    // Hard-block only if capability is paused entirely.
    if (cap.status === 'paused' || cap.status === 'placeholder') {
      return `${def.label} blocked: capability ${cap.status}`;
    }
  }
  return null;
}

export function approveStep(state: AgentLoopState, stepId: string): AgentLoopState {
  if (!state.plan) return { ...state, error: 'No active plan' };
  const steps = state.plan.steps.map((step) => {
    if (step.id !== stepId) return step;
    const gate = assertToolAllowed(step.toolId);
    if (gate) {
      return { ...step, status: 'failed' as const, error: gate, decidedAt: Date.now() };
    }
    return { ...step, status: 'approved' as const, decidedAt: Date.now() };
  });
  const step = steps.find((s) => s.id === stepId);
  if (!step) return { ...state, error: 'Unknown step' };
  if (step.status === 'failed') {
    return {
      ...state,
      plan: { ...state.plan, steps },
      status: 'error',
      error: step.error ?? 'Step failed capability gate',
      memory: rememberDecision(state.memory, 'reject', stepId, step.toolId),
    };
  }
  return {
    ...state,
    plan: { ...state.plan, steps },
    status: 'awaiting_hitl',
    error: null,
    memory: rememberDecision(state.memory, 'approve', stepId, step.toolId),
  };
}

export function rejectStep(state: AgentLoopState, stepId: string): AgentLoopState {
  if (!state.plan) return { ...state, error: 'No active plan' };
  const steps = state.plan.steps.map((step) =>
    step.id === stepId
      ? { ...step, status: 'rejected' as const, decidedAt: Date.now() }
      : step,
  );
  const step = steps.find((s) => s.id === stepId);
  return {
    ...state,
    plan: { ...state.plan, steps },
    status: 'awaiting_hitl',
    error: null,
    memory: rememberDecision(state.memory, 'reject', stepId, step?.toolId ?? 'unknown'),
  };
}

export function beginExecuteStep(state: AgentLoopState, stepId: string): AgentLoopState {
  if (!state.plan) return { ...state, error: 'No active plan' };
  const step = state.plan.steps.find((s) => s.id === stepId);
  if (!step) return { ...state, error: 'Unknown step' };
  const def = requireAgentTool(step.toolId);
  if (def.requiresHitl && step.status !== 'approved') {
    return { ...state, error: 'Step requires approval before execute' };
  }
  const gate = assertToolAllowed(step.toolId);
  if (gate) return { ...state, error: gate };

  const steps = state.plan.steps.map((s) =>
    s.id === stepId ? { ...s, status: 'executing' as const } : s,
  );
  return {
    ...state,
    plan: { ...state.plan, steps },
    status: 'executing',
    error: null,
  };
}

export function observeStep(
  state: AgentLoopState,
  stepId: string,
  result: AgentToolResult,
): AgentLoopState {
  if (!state.plan) return { ...state, error: 'No active plan' };
  const step = state.plan.steps.find((s) => s.id === stepId);
  if (!step) return { ...state, error: 'Unknown step' };
  const def = requireAgentTool(step.toolId);

  if (def.requiresReceipt && result.ok && !result.receiptConfirmed) {
    result = {
      ...result,
      ok: false,
      message: 'Receipt not confirmed — treating as incomplete (not successful).',
    };
  }

  const steps = state.plan.steps.map((s) =>
    s.id === stepId
      ? {
          ...s,
          status: result.ok ? ('completed' as const) : ('failed' as const),
          result,
          error: result.ok ? undefined : result.message,
          completedAt: Date.now(),
        }
      : s,
  );

  const pendingHitl = steps.some((s) => {
    const d = requireAgentTool(s.toolId);
    return d.requiresHitl && (s.status === 'proposed' || s.status === 'approved');
  });

  return {
    ...state,
    plan: { ...state.plan, steps },
    status: pendingHitl ? 'awaiting_hitl' : result.ok ? 'observing' : 'error',
    error: result.ok ? null : result.message,
    memory: rememberObservation(
      state.memory,
      stepId,
      step.toolId,
      result.ok,
      result.transactionHash,
      typeof step.args.value === 'string' ? step.args.value : undefined,
      typeof step.args.epochId === 'number' ? step.args.epochId : undefined,
    ),
  };
}

export function autoCompleteReadOnlySteps(
  state: AgentLoopState,
  runReadOnly: (step: AgentToolCall) => AgentToolResult,
): AgentLoopState {
  if (!state.plan) return state;
  let next = state;
  for (const step of state.plan.steps) {
    const def = requireAgentTool(step.toolId);
    if (!def.readOnly || step.status !== 'proposed') continue;
    next = beginExecuteStep(next, step.id);
    const result = runReadOnly(step);
    next = observeStep(next, step.id, result);
  }
  return next;
}
