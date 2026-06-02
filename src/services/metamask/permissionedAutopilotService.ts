import type { Address } from 'viem';
import MEGAPOT_V2_CONTRACTS from '@/config/contracts';
import { FEATURES } from '@/config';
import type { AdvancedPermissionGrant } from '@/services/automation/erc7715Service';
import { getUsdcAddressForChain } from '@/services/automation/erc7715Service';
import type { VaultProtocol } from '@/services/vaults/vaultProvider';
import type {
  PermissionedAutopilotDelegation,
  PermissionedAutopilotMode,
  PermissionedAutopilotPolicy,
  PermissionedAutopilotRelayer,
} from './delegationTypes';

const STORAGE_KEY = 'syndicate:permissioned-autopilot-policies';
export const PERMISSIONED_AUTOPILOT_STORAGE_EVENT = 'syndicate:permissioned-autopilot-updated';

interface CreatePolicyInput {
  mode: PermissionedAutopilotMode;
  permission: AdvancedPermissionGrant;
  chainId: number;
  sourceVault?: VaultProtocol;
  maxSpendPerPeriod: bigint;
  period: 'weekly' | 'monthly';
  ticketCount: number;
  userAddress?: Address;
  relayer?: PermissionedAutopilotRelayer;
}

class PermissionedAutopilotService {
  createPolicy(input: CreatePolicyInput): PermissionedAutopilotPolicy {
    const policy: PermissionedAutopilotPolicy = {
      id: `autopilot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      mode: input.mode,
      userAddress: input.userAddress,
      permissionId: input.permission.id,
      sourceVault: input.sourceVault ?? 'spark',
      tokenAddress: getUsdcAddressForChain(input.chainId),
      targetContract: MEGAPOT_V2_CONTRACTS.randomTicketBuyer.address,
      targetFunction: 'buyTickets',
      maxSpendPerPeriod: input.maxSpendPerPeriod.toString(),
      period: input.period,
      ticketCount: input.ticketCount,
      preservePrincipal: input.mode === 'yield-autopilot',
      relayer: input.relayer ?? (FEATURES.enable1ShotRelayer ? '1shot' : 'direct'),
      permissionContext: extractPermissionContext(input.permission.context),
      createdAt: Date.now(),
      expiresAt: input.permission.expiresAt ? input.permission.expiresAt * 1000 : null,
      isActive: true,
    };

    this.savePolicy(policy);
    return policy;
  }

  getPolicies(): PermissionedAutopilotPolicy[] {
    if (typeof window === 'undefined') return [];

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  getActivePolicies(): PermissionedAutopilotPolicy[] {
    return this.getPolicies().filter((policy) => policy.isActive);
  }

  deactivatePolicy(policyId: string): void {
    const policies = this.getPolicies().map((policy) => (
      policy.id === policyId ? { ...policy, isActive: false } : policy
    ));
    this.savePolicies(policies);
  }

  savePolicy(policy: PermissionedAutopilotPolicy): void {
    if (typeof window === 'undefined') return;

    const policies = this.getPolicies().filter((existing) => existing.id !== policy.id);
    policies.unshift(policy);
    this.savePolicies(policies);
  }

  private savePolicies(policies: PermissionedAutopilotPolicy[]): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(policies));
    window.dispatchEvent(new Event(PERMISSIONED_AUTOPILOT_STORAGE_EVENT));
  }
}

export const permissionedAutopilotService = new PermissionedAutopilotService();

function extractPermissionContext(context: unknown): PermissionedAutopilotDelegation[] | undefined {
  if (!context || typeof context !== 'object') return undefined;

  if (Array.isArray(context) && isDelegationArray(context)) {
    return context;
  }

  const record = context as Record<string, unknown>;
  const candidates = [
    record.permissionContext,
    record.delegations,
    record.delegation,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && isDelegationArray(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function isDelegationArray(value: unknown[]): value is PermissionedAutopilotDelegation[] {
  return value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return (
      typeof record.delegate === 'string' &&
      typeof record.delegator === 'string' &&
      typeof record.authority === 'string' &&
      Array.isArray(record.caveats) &&
      typeof record.salt === 'string' &&
      typeof record.signature === 'string'
    );
  });
}
