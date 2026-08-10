/**
 * Shared client binder for agent loops: plan → (HITL) → execute → observe.
 *
 * Domain hooks supply read-only runners and mutating executors only.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { requireAgentTool } from '@/services/agents/tools';
import type {
  AgentLoopState,
  AgentPlan,
  AgentToolCall,
  AgentToolResult,
} from '@/services/agents/tools/types';
import {
  applyPlan,
  approveStep,
  autoCompleteReadOnlySteps,
  beginExecuteStep,
  createInitialAgentLoopState,
  observeStep,
  rejectStep,
} from '@/services/agents/loop/agentLoop';
import { recordAgentTransition } from '@/services/agents/transcript/agentSessionTranscript';

export type AgentReadOnlyRunner = (step: AgentToolCall) => AgentToolResult;
export type AgentMutatingExecutor = (
  step: AgentToolCall,
  state: AgentLoopState,
) => Promise<AgentToolResult>;

export function useAgentLoop() {
  const [loop, setLoop] = useState<AgentLoopState>(() => createInitialAgentLoopState());
  const loopRef = useRef(loop);
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const applyFetchedPlan = useCallback((plan: AgentPlan, runReadOnly: AgentReadOnlyRunner) => {
    setLoop((prev) => autoCompleteReadOnlySteps(applyPlan(prev, plan), runReadOnly));
    recordAgentTransition('agent.plan_created', 'plan', {
      sessionId: loopRef.current.memory.sessionId,
      label: `Plan created (${plan.source})`,
      detail: `${plan.steps.length} step${plan.steps.length === 1 ? '' : 's'} — ${plan.rationale[0] ?? 'no rationale'}`,
      source: plan.source,
    });
  }, []);

  const failPlan = useCallback((message: string) => {
    setLoop((prev) => ({
      ...prev,
      status: 'error',
      error: message,
    }));
    recordAgentTransition('agent.plan_failed', 'plan_failed', {
      sessionId: loopRef.current.memory.sessionId,
      label: 'Plan failed',
      detail: message,
      errorMessage: message,
    });
  }, []);

  const withPlanning = useCallback(async (fn: () => Promise<void>) => {
    setPlanning(true);
    try {
      await fn();
    } finally {
      setPlanning(false);
    }
  }, []);

  const approve = useCallback((stepId: string) => {
    const step = loopRef.current.plan?.steps.find((s) => s.id === stepId);
    setLoop((prev) => approveStep(prev, stepId));
    if (step) {
      recordAgentTransition('agent.step_approved', 'approve', {
        sessionId: loopRef.current.memory.sessionId,
        toolId: step.toolId,
        label: `Approved: ${requireAgentTool(step.toolId).label}`,
        detail: 'HITL: user confirmed the proposed tool call',
      });
    }
  }, []);

  const reject = useCallback((stepId: string) => {
    const step = loopRef.current.plan?.steps.find((s) => s.id === stepId);
    setLoop((prev) => rejectStep(prev, stepId));
    if (step) {
      recordAgentTransition('agent.step_rejected', 'reject', {
        sessionId: loopRef.current.memory.sessionId,
        toolId: step.toolId,
        label: `Rejected: ${requireAgentTool(step.toolId).label}`,
        detail: 'HITL: user declined the proposed tool call',
      });
    }
  }, []);

  const execute = useCallback(
    async (
      stepId: string,
      options: {
        runReadOnly: AgentReadOnlyRunner;
        executeMutating: AgentMutatingExecutor;
        /** Return an error message to block execute (e.g. wrong chain). */
        precheck?: () => string | null;
      },
    ) => {
      const blocked = options.precheck?.() ?? null;
      if (blocked) {
        setLoop((prev) => ({
          ...prev,
          status: 'error',
          error: blocked,
        }));
        return;
      }

      const before = beginExecuteStep(loopRef.current, stepId);
      setLoop(before);
      const step = before.plan?.steps.find((s) => s.id === stepId);
      if (!step || before.error) return;

      const def = requireAgentTool(step.toolId);
      const sessionId = loopRef.current.memory.sessionId;
      recordAgentTransition('agent.step_executed', 'execute', {
        sessionId,
        toolId: step.toolId,
        label: `Executing: ${def.label}`,
        detail: def.requiresHitl ? 'Wallet signature requested' : 'Read-only tool',
      });

      if (def.readOnly) {
        setLoop(observeStep(before, stepId, options.runReadOnly(step)));
        return;
      }

      let result: AgentToolResult;
      try {
        result = await options.executeMutating(step, before);
      } catch (err) {
        result = {
          ok: false,
          message: err instanceof Error ? err.message : 'Execution failed',
        };
      }

      recordAgentTransition(
        result.ok ? 'agent.step_completed' : 'agent.step_failed',
        result.ok ? 'complete' : 'fail',
        {
          sessionId,
          toolId: step.toolId,
          label: `${result.ok ? 'Completed' : 'Failed'}: ${def.label}`,
          detail: result.message,
          txHash: result.transactionHash,
          errorMessage: result.ok ? undefined : result.message,
        },
      );

      setLoop((prev) => observeStep(prev, stepId, result));
    },
    [],
  );

  const reset = useCallback(() => {
    setLoop(createInitialAgentLoopState());
  }, []);

  return {
    loop,
    planning,
    applyFetchedPlan,
    failPlan,
    withPlanning,
    approve,
    reject,
    execute,
    reset,
  };
}
