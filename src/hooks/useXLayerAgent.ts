/**
 * useXLayerAgent — X Layer adapters over the shared agent loop binder.
 *
 * plan (API) → auto-run read-only tools → HITL approve → execute → observe
 */

'use client';

import { useCallback, useState } from 'react';
import { isAddress, type Address } from 'viem';
import { useReadContract } from 'wagmi';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useAgentLoop } from '@/hooks/useAgentLoop';
import {
  XLAYER_HOOK_ABI,
  XLAYER_HOOK_IS_CONFIGURED,
  XLAYER_ORACLE_ADDRESS,
  XLAYER_PRIZE_POOL_HOOK_ADDRESS,
  XLAYER_TESTNET_CHAIN_ID,
} from '@/config/xlayer';
import { useXLayerKeeper } from '@/services/xlayer/useXLayerKeeper';
import { useXLayerDeposit } from '@/services/xlayer/useXLayerDeposit';
import { XLAYER_DEMO_ORACLE_ABI } from '@/services/xlayer/abi';
import { getCapability } from '@/config/capabilities';
import { ensureXLayerToolsRegistered } from '@/services/agents/tools';
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

ensureXLayerToolsRegistered();

export function useXLayerAgent() {
  const { address, chainId } = useUnifiedWallet();
  const keeper = useXLayerKeeper();
  const depositFlow = useXLayerDeposit();
  const {
    loop,
    planning,
    applyFetchedPlan,
    failPlan,
    withPlanning,
    approve,
    reject,
    execute: runExecute,
    reset: resetLoop,
  } = useAgentLoop();
  const [recommendation, setRecommendation] = useState<XLayerKeeperRecommendation | null>(null);

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

  const { data: hookOwner } = useReadContract({
    address: hook,
    abi: XLAYER_HOOK_ABI,
    functionName: 'owner',
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: hookConfigured },
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
      await withPlanning(async () => {
        try {
          const writesEnabled = getCapability('xlayer_prize_pool').writesEnabled;
          const enriched: XLayerKeeperPoolState = {
            ...poolState,
            writesEnabled,
            hookOwnerMatchesWallet:
              poolState.hookOwnerMatchesWallet ??
              Boolean(
                address &&
                  hookOwner &&
                  (hookOwner as string).toLowerCase() === address.toLowerCase(),
              ),
          };
          const res = await fetch('/api/agent/xlayer/plan', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ poolState: enriched }),
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
          applyFetchedPlan(body.plan, runReadOnly);
        } catch (err) {
          failPlan(err instanceof Error ? err.message : 'Plan failed');
        }
      });
    },
    [address, applyFetchedPlan, failPlan, hookOwner, runReadOnly, withPlanning],
  );

  const executeMutating = useCallback(
    async (step: AgentToolCall, state: AgentLoopState): Promise<AgentToolResult> => {
      if (step.toolId === 'xlayer.openDraw') {
        const r = await keeper.openDraw();
        return {
          ok: Boolean(r.success && r.transactionHash),
          message: r.success ? 'Draw opened.' : (r.error ?? 'openDraw failed'),
          transactionHash: r.transactionHash,
          receiptConfirmed: Boolean(r.success && r.transactionHash),
        };
      }
      if (step.toolId === 'xlayer.setDemoOracle') {
        const ownerOk =
          address &&
          oracleOwner &&
          (oracleOwner as string).toLowerCase() === address.toLowerCase();
        if (!ownerOk) {
          return { ok: false, message: 'Connected wallet is not the demo oracle owner.' };
        }
        const value = BigInt(String(step.args.value ?? '0'));
        const epochId = BigInt(String(step.args.epochId ?? 0));
        const r = await keeper.setDemoOracleValue({
          epochId: epochId === 0n ? 1n : epochId,
          value,
          oracleAddress,
        });
        return {
          ok: Boolean(r.success && r.transactionHash),
          message: r.success ? 'Demo oracle value set.' : (r.error ?? 'setDemoOracle failed'),
          transactionHash: r.transactionHash,
          receiptConfirmed: Boolean(r.success && r.transactionHash),
          data: { value: value.toString(), epochId: epochId.toString() },
        };
      }
      if (step.toolId === 'xlayer.fulfillRandomness') {
        const memValue = state.memory.demoOracleValue;
        const value = BigInt(String(step.args.value ?? memValue ?? '0'));
        const r = await keeper.fulfillRandomness(value);
        return {
          ok: Boolean(r.success && r.transactionHash),
          message: r.success ? 'Randomness fulfilled.' : (r.error ?? 'fulfill failed'),
          transactionHash: r.transactionHash,
          receiptConfirmed: Boolean(r.success && r.transactionHash),
        };
      }
      if (step.toolId === 'xlayer.deposit') {
        const amountUsdc = String(step.args.amountUsdc ?? '5');
        const r = await depositFlow.deposit({ amountUsdc });
        return {
          ok: Boolean(r.success && r.transactionHash),
          message: r.success ? `Deposited ${amountUsdc} USDC.` : (r.error ?? 'deposit failed'),
          transactionHash: r.transactionHash,
          receiptConfirmed: Boolean(r.success && r.transactionHash),
          data: { amountUsdc },
        };
      }
      if (step.toolId === 'xlayer.fundPot') {
        const amountUsdc = String(step.args.amountUsdc ?? '1');
        const r = await depositFlow.fundPot({ amountUsdc });
        return {
          ok: Boolean(r.success && r.transactionHash),
          message: r.success ? `Funded pot with ${amountUsdc} USDC.` : (r.error ?? 'fundPot failed'),
          transactionHash: r.transactionHash,
          receiptConfirmed: Boolean(r.success && r.transactionHash),
          data: { amountUsdc },
        };
      }
      if (step.toolId === 'xlayer.claimPrize') {
        const r = await keeper.claimPrize();
        return {
          ok: Boolean(r.success && r.transactionHash),
          message: r.success ? 'Prize claimed.' : (r.error ?? 'claim failed'),
          transactionHash: r.transactionHash,
          receiptConfirmed: Boolean(r.success && r.transactionHash),
        };
      }
      return { ok: false, message: `Unsupported tool ${step.toolId}` };
    },
    [address, depositFlow, keeper, oracleAddress, oracleOwner],
  );

  const execute = useCallback(
    async (stepId: string) => {
      await runExecute(stepId, {
        runReadOnly,
        executeMutating,
        precheck: () =>
          chainId !== XLAYER_TESTNET_CHAIN_ID
            ? 'Switch to X Layer testnet before executing tools.'
            : null,
      });
      keeper.reset();
      depositFlow.reset();
    },
    [chainId, depositFlow, executeMutating, keeper, runExecute, runReadOnly],
  );

  const reset = useCallback(() => {
    resetLoop();
    setRecommendation(null);
    keeper.reset();
    depositFlow.reset();
  }, [depositFlow, keeper, resetLoop]);

  return {
    loop,
    recommendation,
    planning,
    isExecuting: keeper.isActive || depositFlow.isActive || loop.status === 'executing',
    oracleOwnerMatchesWallet: Boolean(
      address && oracleOwner && (oracleOwner as string).toLowerCase() === address.toLowerCase(),
    ),
    hookOwnerMatchesWallet: Boolean(
      address && hookOwner && (hookOwner as string).toLowerCase() === address.toLowerCase(),
    ),
    plan,
    approve,
    reject,
    execute,
    reset,
  };
}
