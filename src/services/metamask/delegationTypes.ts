import type { Address, Hex } from 'viem';
import type { VaultProtocol } from '@/services/vaults';

export type PermissionedAutopilotMode = 'scheduled-public-play' | 'yield-autopilot';
export type PermissionedAutopilotRelayer = 'direct' | '1shot';

export interface PermissionedAutopilotDelegation {
  delegate: Address;
  delegator: Address;
  authority: string;
  caveats: Array<{
    enforcer: Address;
    terms: Hex | string;
    args: Hex | string;
    [key: string]: unknown;
  }>;
  salt: Hex | string;
  signature: Hex | string;
  [key: string]: unknown;
}

export interface PermissionedAutopilotPolicy {
  id: string;
  mode: PermissionedAutopilotMode;
  userAddress?: Address;
  permissionId: string;
  sourceVault: VaultProtocol;
  tokenAddress: Address;
  targetContract: Address;
  targetFunction: 'buyTickets';
  maxSpendPerPeriod: string;
  period: 'weekly' | 'monthly';
  ticketCount: number;
  preservePrincipal: boolean;
  relayer: PermissionedAutopilotRelayer;
  permissionContext?: PermissionedAutopilotDelegation[];
  createdAt: number;
  expiresAt: number | null;
  isActive: boolean;
}
