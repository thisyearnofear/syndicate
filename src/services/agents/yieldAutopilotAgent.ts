import { encodeFunctionData, parseAbi, parseEther, type Address, type Hex, zeroHash } from 'viem';
import { REFERRALS } from '@/config';
import { vaultManager } from '@/services/vaults';
import type { PermissionedAutopilotPolicy } from '@/services/metamask/delegationTypes';
import { oneShotRelayerService, type OneShotRelayerResult } from '@/services/metamask/oneShotRelayerService';
import { permissionedAutopilotService } from '@/services/metamask/permissionedAutopilotService';

export type YieldAutopilotActivityStatus = 'ready' | 'waiting' | 'blocked';

export interface YieldAutopilotActivity {
  policyId: string;
  status: YieldAutopilotActivityStatus;
  sourceVault: PermissionedAutopilotPolicy['sourceVault'];
  yieldAmount: string;
  maxSpend: string;
  ticketsPlanned: number;
  message: string;
  checkedAt: number;
  executionPlan?: YieldAutopilotExecutionPlan;
}

export interface YieldAutopilotExecutionPlan {
  policyId: string;
  chainId: number;
  from: Address;
  to: Address;
  data: Hex;
  value: '0';
  permissionId: string;
  ticketsPlanned: number;
  maxSpendUsdc: string;
  relayer: PermissionedAutopilotPolicy['relayer'];
  permissionContext?: PermissionedAutopilotPolicy['permissionContext'];
}

export interface YieldAutopilotExecutionResult {
  success: boolean;
  status: 'client-signature-required' | 'direct-submitted' | 'relayer-submitted' | 'relayer-missing-permission-context' | 'failed';
  message: string;
  approvalHash?: Hex;
  transactionHash?: Hex;
  relayerResult?: OneShotRelayerResult;
}

const RANDOM_TICKET_BUYER_ABI = parseAbi([
  'function buyTickets(uint256 _count, address _recipient, address[] _referrers, uint256[] _referralSplitBps, bytes32 _source)',
]);

class YieldAutopilotAgent {
  async planPolicy(policy: PermissionedAutopilotPolicy): Promise<YieldAutopilotActivity> {
    if (!policy.userAddress) {
      return this.blocked(policy, 'Connect the original wallet to check accrued yield.');
    }

    try {
      const yieldAmount = await vaultManager.getProvider(policy.sourceVault).getYieldAccrued(policy.userAddress);
      const availableYield = Math.max(0, Number.parseFloat(yieldAmount));
      const maxSpend = Number(BigInt(policy.maxSpendPerPeriod)) / 1_000_000;
      const spendable = Math.min(availableYield, maxSpend);
      const ticketsPlanned = Math.min(policy.ticketCount, Math.floor(spendable));

      if (ticketsPlanned <= 0) {
        return {
          policyId: policy.id,
          status: 'waiting',
          sourceVault: policy.sourceVault,
          yieldAmount,
          maxSpend: maxSpend.toFixed(2),
          ticketsPlanned: 0,
          message: `Waiting for at least 1 USDC of available ${policy.sourceVault} yield.`,
          checkedAt: Date.now(),
        };
      }

      return {
        policyId: policy.id,
        status: 'ready',
        sourceVault: policy.sourceVault,
        yieldAmount,
        maxSpend: maxSpend.toFixed(2),
        ticketsPlanned,
        message: `Ready to prepare ${ticketsPlanned} ticket${ticketsPlanned === 1 ? '' : 's'} from accrued yield.`,
        checkedAt: Date.now(),
        executionPlan: this.buildExecutionPlan(policy, ticketsPlanned, maxSpend.toFixed(2)),
      };
    } catch (error) {
      return this.blocked(
        policy,
        error instanceof Error ? error.message : 'Unable to check accrued yield.'
      );
    }
  }

  async planActivePolicies(): Promise<YieldAutopilotActivity[]> {
    const policies = permissionedAutopilotService.getActivePolicies();
    return Promise.all(policies.map((policy) => this.planPolicy(policy)));
  }

  async executePreparedPlan(plan: YieldAutopilotExecutionPlan): Promise<YieldAutopilotExecutionResult> {
    if (plan.relayer === '1shot') {
      const relayerResult = await oneShotRelayerService.submit({
        chainId: plan.chainId,
        from: plan.from,
        to: plan.to,
        data: plan.data,
        value: plan.value,
        permissionId: plan.permissionId,
        permissionContext: plan.permissionContext,
        memo: `yield-autopilot:${plan.policyId}`,
      });

      if (relayerResult.success) {
        return {
          success: true,
          status: 'relayer-submitted',
          message: 'Submitted to 1Shot relayer.',
          relayerResult,
        };
      }

      return {
        success: false,
        status: relayerResult.status === 'missing-permission-context' ? 'relayer-missing-permission-context' : 'failed',
        message: relayerResult.error ?? '1Shot relayer submission failed.',
        relayerResult,
      };
    }

    return {
      success: false,
      status: 'client-signature-required',
      message: 'Direct execution requires client-side wallet signing and is not submitted by the server.',
    };
  }

  private blocked(policy: PermissionedAutopilotPolicy, message: string): YieldAutopilotActivity {
    return {
      policyId: policy.id,
      status: 'blocked',
      sourceVault: policy.sourceVault,
      yieldAmount: '0',
      maxSpend: (Number(BigInt(policy.maxSpendPerPeriod)) / 1_000_000).toFixed(2),
      ticketsPlanned: 0,
      message,
      checkedAt: Date.now(),
    };
  }

  private buildExecutionPlan(
    policy: PermissionedAutopilotPolicy,
    ticketsPlanned: number,
    maxSpendUsdc: string
  ): YieldAutopilotExecutionPlan | undefined {
    if (!policy.userAddress) return undefined;

    return {
      policyId: policy.id,
      chainId: 8453,
      from: policy.userAddress,
      to: policy.targetContract,
      data: encodeFunctionData({
        abi: RANDOM_TICKET_BUYER_ABI,
        functionName: 'buyTickets',
        args: [
          BigInt(ticketsPlanned),
          policy.userAddress,
          [REFERRALS.megapotReferrer],
          [parseEther('1')],
          zeroHash,
        ],
      }),
      value: '0',
      permissionId: policy.permissionId,
      ticketsPlanned,
      maxSpendUsdc,
      relayer: policy.relayer,
      permissionContext: policy.permissionContext,
    };
  }
}

export const yieldAutopilotAgent = new YieldAutopilotAgent();
