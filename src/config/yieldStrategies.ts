/**
 * YIELD STRATEGIES CONFIGURATION
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for yield strategy definitions
 * - CONSOLIDATION: Extracted from YieldStrategySelector and ImprovedYieldStrategySelector
 */

import type { SyndicateInfo } from '@/domains/lottery/types';

export interface YieldStrategyConfig {
  id: SyndicateInfo['vaultStrategy'];
  name: string;
  description: string;
  icon: string;
  color: string;
  risk: 'Low' | 'Medium' | 'High';
  isOctant?: boolean;
}

export const YIELD_STRATEGIES: YieldStrategyConfig[] = [
  {
    id: 'aave',
    name: 'Aave V3',
    description: 'Stable lending on Base with variable rates',
    icon: '🏦',
    color: 'bg-gradient-to-br from-blue-500 to-cyan-400',
    risk: 'Low',
  },
  {
    id: 'drift',
    name: 'Drift Delta Neutral',
    description: 'JLP Delta Neutral Vault on Solana. 3-Month lock, ~22% APY USDC yield routed to tickets.',
    icon: '⛵',
    color: 'bg-gradient-to-br from-sky-400 to-blue-600',
    risk: 'Medium',
  },
  {
    id: 'morpho',
    name: 'Morpho Blue',
    description: 'Curated lending vaults on Base with optimized yields (~6.7% APY)',
    icon: '⚡',
    color: 'bg-gradient-to-br from-purple-500 to-pink-400',
    risk: 'Medium',
  },
  {
    id: 'pooltogether',
    name: 'PoolTogether V5',
    description: 'No-loss prize savings on Base. Keep 100% principal, win prizes every draw.',
    icon: '🎰',
    color: 'bg-gradient-to-br from-yellow-400 to-amber-600',
    risk: 'Low',
  },
];

export function getStrategyById(id: SyndicateInfo['vaultStrategy']): YieldStrategyConfig | undefined {
  return YIELD_STRATEGIES.find(s => s.id === id);
}
