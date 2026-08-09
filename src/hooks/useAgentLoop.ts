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
  }, []);

  const failPlan = useCallback((message: string) => {
    setLoop((prev) => ({
      ...prev,
      status: 'error',
      error: message,
    }));
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
    setLoop((prev) => approveStep(prev, stepId));
  }, []);

  const reject = useCallback((stepId: string) => {
    setLoop((prev) => rejectStep(prev, stepId));
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
