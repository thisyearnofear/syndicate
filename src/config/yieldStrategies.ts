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
    description: 'Stable lending with variable rates',
    icon: '🏦',
    color: 'bg-gradient-to-br from-blue-500 to-cyan-400',
    risk: 'Low',
  },
  {
    id: 'morpho',
    name: 'Morpho Blue',
    description: 'Optimized markets with peer-to-peer matching',
    icon: '⚡',
    color: 'bg-gradient-to-br from-purple-500 to-pink-400',
    risk: 'Medium',
  },
  {
    id: 'spark',
    name: 'Spark Protocol',
    description: 'MakerDAO lending with DAI integration',
    icon: '✨',
    color: 'bg-gradient-to-br from-green-500 to-emerald-400',
    risk: 'Low',
  },
  {
    id: 'uniswap',
    name: 'Uniswap V4',
    description: 'Concentrated liquidity strategies',
    icon: '🦄',
    color: 'bg-gradient-to-br from-orange-500 to-red-400',
    risk: 'High',
  },
  {
    id: 'octant',
    name: 'Octant Native',
    description: 'Purpose-built for yield donating',
    icon: '🎯',
    color: 'bg-gradient-to-br from-indigo-500 to-purple-400',
    risk: 'Low',
    isOctant: true,
  },
  {
    id: 'drift',
    name: 'Drift Delta Neutral',
    description: 'JLP Delta Neutral Vault (Solana, 3-Month Lock). Earns >10% APY USDC with automated yield routing.',
    icon: '⛵',
    color: 'bg-gradient-to-br from-sky-400 to-blue-600',
    risk: 'Medium',
  },
  {
    id: 'pooltogether',
    name: 'PoolTogether V5',
    description: 'No-loss prize savings on EVM. Deposit USDC, keep your principal, win prizes every draw.',
    icon: '🎰',
    color: 'bg-gradient-to-br from-yellow-400 to-amber-600',
    risk: 'Low',
  },
];

export function getStrategyById(id: SyndicateInfo['vaultStrategy']): YieldStrategyConfig | undefined {
  return YIELD_STRATEGIES.find(s => s.id === id);
}
