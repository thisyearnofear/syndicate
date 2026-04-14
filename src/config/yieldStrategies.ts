/**
 * YIELD STRATEGIES CONFIGURATION
 *
 * Core Principles Applied:
 * - DRY: Single source of truth for yield strategy definitions
 * - CONSOLIDATION: Extracted from YieldStrategySelector and ImprovedYieldStrategySelector
 */

export type SupportedYieldStrategyId =
  | 'aave'
  | 'drift'
  | 'morpho'
  | 'pooltogether'
  | 'octant'
  | 'uniswap'
  | 'lifiearn';

export interface YieldStrategyConfig {
  id: SupportedYieldStrategyId;
  name: string;
  description: string;
  icon: string;
  color: string;
  risk: 'Low' | 'Medium' | 'High';
  isOctant?: boolean;
  isPaused?: boolean;
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
    description: 'JLP Delta Neutral Vault on Solana. 3-Month lock, ~22% APY USDC yield routed to tickets. [PAUSED - Security Incident]',
    icon: '⛵',
    color: 'bg-gradient-to-br from-sky-400 to-blue-600',
    risk: 'Medium',
    isPaused: true,
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
  {
    id: 'octant',
    name: 'Octant V2',
    description: 'Yield donating vaults supporting public goods. ~10% APY with social impact.',
    icon: '🌍',
    color: 'bg-gradient-to-br from-green-500 to-emerald-400',
    risk: 'Low',
    isOctant: true,
  },
  {
    id: 'lifiearn',
    name: 'LI.FI Earn',
    description: 'Cross-chain vault aggregator. Access 20+ protocols across 60+ chains with one-click deposits.',
    icon: '🔀',
    color: 'bg-gradient-to-br from-indigo-500 to-purple-600',
    risk: 'Low',
  },
];

export function getStrategyById(id: SupportedYieldStrategyId): YieldStrategyConfig | undefined {
  return YIELD_STRATEGIES.find(s => s.id === id);
}
