/**
 * Base yield / autopilot tools — product-home agent surface.
 *
 * Read-only / advisory only: MetaMask policy approval remains the write boundary.
 * Mirrors the X Layer registry pattern without a parallel abstraction.
 */

import { getAgentTool, registerAgentTool } from './registry';
import type { AgentToolDefinition, BaseToolId } from './types';

export const BASE_AGENT_TOOLS: AgentToolDefinition[] = [
  {
    id: 'base.getYieldSnapshot',
    label: 'Read yield snapshot',
    description: 'Inspect available vault yield and the active autopilot spend cap.',
    capabilityId: 'automation_erc7715',
    chains: ['base'],
    requiresHitl: false,
    requiresReceipt: false,
    readOnly: true,
  },
  {
    id: 'base.planYieldSpend',
    label: 'Plan yield spend',
    description:
      'Compute how many Megapot tickets the available yield can fund under the policy cap (principal preserved).',
    capabilityId: 'automation_erc7715',
    chains: ['base'],
    requiresHitl: false,
    requiresReceipt: false,
    readOnly: true,
  },
  {
    id: 'base.proposeAutopilotPolicy',
    label: 'Propose autopilot policy',
    description:
      'Suggest a capped yield-only MetaMask policy. You still review and approve the permission in-wallet.',
    capabilityId: 'automation_erc7715',
    chains: ['base'],
    requiresHitl: false,
    requiresReceipt: false,
    readOnly: true,
  },
];

export function ensureBaseToolsRegistered(): void {
  if (getAgentTool('base.getYieldSnapshot')) return;
  for (const tool of BASE_AGENT_TOOLS) {
    if (!getAgentTool(tool.id)) registerAgentTool(tool);
  }
}

export function isBaseToolId(id: string): id is BaseToolId {
  return id.startsWith('base.');
}
