/**
 * useXLayerAgent — client binding for the X Layer agent loop.
 *
 * plan (API) → auto-run read-only tools → HITL approve → execute via useXLayerKeeper → observe
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { isAddress, type Address } from 'viem';
import { useReadContract } from 'wagmi';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import {
  XLAYER_HOOK_ABI,
  XLAYER_HOOK_IS_CONFIGURED,
  XLAYER_ORACLE_ADDRESS,
  XLAYER_PRIZE_POOL_HOOK_ADDRESS,
  XLAYER_TESTNET_CHAIN_ID,
} from '@/config/xlayer';
import { useXLayerKeeper } from '@/services/xlayer/useXLayerKeeper';
import { XLAYER_DEMO_ORACLE_ABI } from '@/services/xlayer/abi';
import { ensureXLayerToolsRegistered, requireAgentTool } from '@/services/agents/tools';
import type {
  AgentLoopState,
  AgentPlan,
  AgentToolCall,
  AgentToolResult,
} from '@/services/agents/tools/types';
import type {
  XLayerKeeperPoolState,
  XLayerKeeperRecommendation,
} from '@/services/agents/veniceXLayerKeeper';
import {
  applyPlan,
  approveStep,
  autoCompleteReadOnlySteps,
  beginExecuteStep,
  createInitialAgentLoopState,
  observeStep,
  rejectStep,
} from '@/services/agents/loop/agentLoop';

ensureXLayerToolsRegistered();

export function useXLayerAgent() {
  const { address, chainId } = useUnifiedWallet();
  const keeper = useXLayerKeeper();
  const [loop, setLoop] = useState<AgentLoopState>(() => createInitialAgentLoopState());
  const loopRef = useRef(loop);
  loopRef.current = loop;

  const [recommendation, setRecommendation] = useState<XLayerKeeperRecommendation | null>(null);
  const [planning, setPlanning] = useState(false);

  const hookConfigured = XLAYER_HOOK_IS_CONFIGURED && isAddress(XLAYER_PRIZE_POOL_HOOK_ADDRESS);
  const hook = XLAYER_PRIZE_POOL_HOOK_ADDRESS as Address;

  const { data: onchainOracle } = useReadContract({
    address: hook,
    abi: XLAYER_HOOK_ABI,
    functionName: 'randomnessOracle',
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: hookConfigured },
  });

  const oracleAddress =
    onchainOracle && isAddress(onchainOracle as string)
      ? (onchainOracle as Address)
      : isAddress(XLAYER_ORACLE_ADDRESS)
        ? (XLAYER_ORACLE_ADDRESS as Address)
        : null;

  const { data: oracleOwner } = useReadContract({
    address: oracleAddress ?? undefined,
    abi: XLAYER_DEMO_ORACLE_ABI,
    functionName: 'owner',
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: Boolean(oracleAddress) },
  });

  const runReadOnly = useCallback((step: AgentToolCall): AgentToolResult => {
    if (step.toolId === 'xlayer.getPoolState') {
      return {
        ok: true,
        message: 'Pool snapshot attached to plan.',
        data: (step.args.snapshot as Record<string, unknown>) ?? {},
      };
    }
    if (step.toolId === 'xlayer.recommendSurcharge') {
      return {
        ok: true,
        message: `Advisory surcharge ${String(step.args.recommendedSurchargeBps)} bps (timelocked if changing).`,
        data: {
          recommendedSurchargeBps: step.args.recommendedSurchargeBps,
          surchargeChangeAllowedNow: false,
        },
      };
    }
    return { ok: false, message: `Not a read-only tool: ${step.toolId}` };
  }, []);

  const plan = useCallback(
    async (poolState: XLayerKeeperPoolState) => {
      setPlanning(true);
      try {
        const res = await fetch('/api/agent/xlayer/plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ poolState }),
        });
        const body = (await res.json()) as {
          success?: boolean;
          plan?: AgentPlan;
          recommendation?: XLayerKeeperRecommendation;
          error?: string;
        };
        if (!res.ok || !body.success || !body.plan) {
          throw new Error(body.error ?? 'Plan failed');
        }
        setRecommendation(body.recommendation ?? null);
        setLoop((prev) => autoCompleteReadOnlySteps(applyPlan(prev, body.plan!), runReadOnly));
      } catch (err) {
        setLoop((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Plan failed',
        }));
      } finally {
        setPlanning(false);
      }
    },
    [runReadOnly],
  );

  const approve = useCallback((stepId: string) => {
    setLoop((prev) => approveStep(prev, stepId));
  }, []);

  const reject = useCallback((stepId: string) => {
    setLoop((prev) => rejectStep(prev, stepId));
  }, []);

  const execute = useCallback(
    async (stepId: string) => {
      if (chainId !== XLAYER_TESTNET_CHAIN_ID) {
        setLoop((prev) => ({
          ...prev,
          status: 'error',
          error: 'Switch to X Layer testnet before executing tools.',
        }));
        return;
      }

      const before = beginExecuteStep(loopRef.current, stepId);
      setLoop(before);
      const step = before.plan?.steps.find((s) => s.id === stepId);
      if (!step || before.error) return;

      const def = requireAgentTool(step.toolId);
      if (def.readOnly) {
        setLoop(observeStep(before, stepId, runReadOnly(step)));
        return;
      }

      let result: AgentToolResult;
      try {
        if (step.toolId === 'xlayer.openDraw') {
          const r = await keeper.openDraw();
          result = {
            ok: Boolean(r.success && r.transactionHash),
            message: r.success ? 'Draw opened.' : (r.error ?? 'openDraw failed'),
            transactionHash: r.transactionHash,
            receiptConfirmed: Boolean(r.success && r.transactionHash),
          };
        } else if (step.toolId === 'xlayer.setDemoOracle') {
          const ownerOk =
            address &&
            oracleOwner &&
            (oracleOwner as string).toLowerCase() === address.toLowerCase();
          if (!ownerOk) {
            result = { ok: false, message: 'Connected wallet is not the demo oracle owner.' };
          } else {
            const value = BigInt(String(step.args.value ?? '0'));
            const epochId = BigInt(String(step.args.epochId ?? 0));
            const r = await keeper.setDemoOracleValue({
              epochId: epochId === 0n ? 1n : epochId,
              value,
              oracleAddress,
            });
            result = {
              ok: Boolean(r.success && r.transactionHash),
              message: r.success ? 'Demo oracle value set.' : (r.error ?? 'setDemoOracle failed'),
              transactionHash: r.transactionHash,
              receiptConfirmed: Boolean(r.success && r.transactionHash),
              data: { value: value.toString(), epochId: epochId.toString() },
            };
          }
        } else if (step.toolId === 'xlayer.fulfillRandomness') {
          const memValue = loopRef.current.memory.demoOracleValue;
          const value = BigInt(String(step.args.value ?? memValue ?? '0'));
          const r = await keeper.fulfillRandomness(value);
          result = {
            ok: Boolean(r.success && r.transactionHash),
            message: r.success ? 'Randomness fulfilled.' : (r.error ?? 'fulfill failed'),
            transactionHash: r.transactionHash,
            receiptConfirmed: Boolean(r.success && r.transactionHash),
          };
        } else if (step.toolId === 'xlayer.claimPrize') {
          const r = await keeper.claimPrize();
          result = {
            ok: Boolean(r.success && r.transactionHash),
            message: r.success ? 'Prize claimed.' : (r.error ?? 'claim failed'),
            transactionHash: r.transactionHash,
            receiptConfirmed: Boolean(r.success && r.transactionHash),
          };
        } else {
          result = { ok: false, message: `Unsupported tool ${step.toolId}` };
        }
      } catch (err) {
        result = {
          ok: false,
          message: err instanceof Error ? err.message : 'Execution failed',
        };
      }

      setLoop((prev) => observeStep(prev, stepId, result));
      keeper.reset();
    },
    [address, chainId, keeper, oracleAddress, oracleOwner, runReadOnly],
  );

  const reset = useCallback(() => {
    setLoop(createInitialAgentLoopState());
    setRecommendation(null);
    keeper.reset();
  }, [keeper]);

  return {
    loop,
    recommendation,
    planning,
    isExecuting: keeper.isActive || loop.status === 'executing',
    oracleOwnerMatchesWallet: Boolean(
      address && oracleOwner && (oracleOwner as string).toLowerCase() === address.toLowerCase(),
    ),
    plan,
    approve,
    reject,
    execute,
    reset,
  };
}
