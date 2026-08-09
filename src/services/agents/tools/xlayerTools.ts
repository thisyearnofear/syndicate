/**
 * X Layer Prize Pool tools — Build X AI Season surface.
 *
 * Every mutating tool requires HITL + receipt. Reads are capability-gated.
 */

import { getAgentTool, registerAgentTool } from './registry';
import type { AgentToolDefinition, AgentToolId, XLayerToolId } from './types';

export const XLAYER_AGENT_TOOLS: AgentToolDefinition[] = [
  {
    id: 'xlayer.getPoolState',
    label: 'Read pool state',
    description: 'Fetch pot, shares, draw epoch, surcharge, and cooldown for the Prize Pool Hook.',
    capabilityId: 'xlayer_prize_pool',
    chains: ['xlayer_testnet'],
    requiresHitl: false,
    requiresReceipt: false,
    readOnly: true,
  },
  {
    id: 'xlayer.recommendSurcharge',
    label: 'Recommend surcharge',
    description:
      'Advise a surcharge bps. Post-bind changes need the configuration timelock — advisory only.',
    capabilityId: 'xlayer_prize_pool',
    chains: ['xlayer_testnet'],
    requiresHitl: false,
    requiresReceipt: false,
    readOnly: true,
  },
  {
    id: 'xlayer.openDraw',
    label: 'Open draw',
    description: 'Snapshot shares and pot, open the next epoch (permissionless keeper call).',
    capabilityId: 'xlayer_prize_pool',
    chains: ['xlayer_testnet'],
    requiresHitl: true,
    requiresReceipt: true,
    readOnly: false,
  },
  {
    id: 'xlayer.setDemoOracle',
    label: 'Set demo oracle',
    description:
      'Owner-only setNextValue on SimpleRandomnessOracle (TESTNET DEMO — not provably fair).',
    capabilityId: 'xlayer_prize_pool',
    chains: ['xlayer_testnet'],
    requiresHitl: true,
    requiresReceipt: true,
    readOnly: false,
  },
  {
    id: 'xlayer.fulfillRandomness',
    label: 'Fulfill randomness',
    description: 'Resolve the open draw with the oracle-accepted beacon value (permissionless).',
    capabilityId: 'xlayer_prize_pool',
    chains: ['xlayer_testnet'],
    requiresHitl: true,
    requiresReceipt: true,
    readOnly: false,
  },
  {
    id: 'xlayer.claimPrize',
    label: 'Claim prize',
    description: 'Winner claims the pot; principal shares are preserved.',
    capabilityId: 'xlayer_prize_pool',
    chains: ['xlayer_testnet'],
    requiresHitl: true,
    requiresReceipt: true,
    readOnly: false,
  },
];

export function ensureXLayerToolsRegistered(): void {
  if (getAgentTool('xlayer.getPoolState')) return;
  for (const tool of XLAYER_AGENT_TOOLS) {
    if (!getAgentTool(tool.id)) registerAgentTool(tool);
  }
}

export function isXLayerToolId(id: string): id is XLayerToolId {
  return id.startsWith('xlayer.');
}

export function actionToToolId(
  action: 'wait' | 'open_draw' | 'set_oracle' | 'fulfill_randomness' | 'claim_prize',
): AgentToolId | null {
  switch (action) {
    case 'open_draw':
      return 'xlayer.openDraw';
    case 'set_oracle':
      return 'xlayer.setDemoOracle';
    case 'fulfill_randomness':
      return 'xlayer.fulfillRandomness';
    case 'claim_prize':
      return 'xlayer.claimPrize';
    default:
      return null;
  }
}
