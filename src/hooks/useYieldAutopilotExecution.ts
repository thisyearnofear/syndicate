"use client";

import { useCallback, useState } from 'react';
import { parseUnits } from 'viem';
import { base } from 'wagmi/chains';
import {
  type YieldAutopilotExecutionPlan,
  type YieldAutopilotExecutionResult,
  yieldAutopilotAgent,
} from '@/services/agents/yieldAutopilotAgent';
import { yieldAutopilotExecutionLog } from '@/services/agents/yieldAutopilotExecutionLog';
import { ERC20_ABI } from '@/abis/erc20';
import { TOKENS } from '@/config/contracts';
import { useEVMClients } from './useEVMClients';
import { useUnifiedWallet } from './useUnifiedWallet';

const RANDOM_TICKET_BUYER_PRICE_ABI = [
  {
    name: 'ticketPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export function useYieldAutopilotExecution() {
  const { address, walletType } = useUnifiedWallet();
  const { ensureBaseChain, publicClient, walletClient } = useEVMClients();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<YieldAutopilotExecutionResult | null>(null);

  const submitPlan = useCallback(async (plan: YieldAutopilotExecutionPlan) => {
    setIsSubmitting(true);
    try {
      let result: YieldAutopilotExecutionResult;

      if (plan.relayer === 'direct') {
        if (walletType !== 'evm') {
          throw new Error('Direct Yield Autopilot execution requires an EVM wallet.');
        }
        if (!address || address.toLowerCase() !== plan.from.toLowerCase()) {
          throw new Error('Connected wallet does not match the policy owner.');
        }
        if (!walletClient || !publicClient) {
          throw new Error('Connect an EVM wallet on Base to submit this execution.');
        }

        await ensureBaseChain();
        let ticketPrice = parseUnits('1', 6);
        try {
          ticketPrice = await publicClient.readContract({
            address: plan.to,
            abi: RANDOM_TICKET_BUYER_PRICE_ABI,
            functionName: 'ticketPrice',
          });
        } catch {
          ticketPrice = parseUnits('1', 6);
        }
        const requiredUsdc = ticketPrice * BigInt(plan.ticketsPlanned);
        const currentAllowance = await publicClient.readContract({
          address: TOKENS.usdc.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [plan.from, plan.to],
        });

        let approvalHash: `0x${string}` | undefined;
        if (currentAllowance < requiredUsdc) {
          approvalHash = await walletClient.writeContract({
            account: plan.from,
            address: TOKENS.usdc.address,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [plan.to, requiredUsdc],
            chain: base,
          });
          await publicClient.waitForTransactionReceipt({ hash: approvalHash });
        }

        const txHash = await walletClient.sendTransaction({
          account: plan.from,
          to: plan.to,
          data: plan.data,
          value: BigInt(plan.value),
          chain: base,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        result = {
          success: true,
          status: 'direct-submitted',
          message: 'Direct wallet execution confirmed.',
          approvalHash,
          transactionHash: txHash,
        };
      } else {
        result = await yieldAutopilotAgent.executePreparedPlan(plan);
      }

      yieldAutopilotExecutionLog.append(plan, result);
      setLastResult(result);
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, [address, ensureBaseChain, publicClient, walletClient, walletType]);

  return {
    isSubmitting,
    lastResult,
    submitPlan,
  };
}
