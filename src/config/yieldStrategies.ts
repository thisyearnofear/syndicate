/**
 * YIELD STRATEGIES CONFIGURATION
 *
 * Core Principles Applied:
 * - DRY: Single source of truth for yield strategy definitions
 * - CONSOLIDATION: Extracted from YieldStrategySelector and ImprovedYieldStrategySelector
 */

export type SupportedYieldStrategyId =
  | 'aave'
  | 'morpho'
  | 'spark'
  | 'pooltogether'
  | 'octant'
  | 'uniswap'
  | 'lifiearn'
  | 'fhenix';

export interface YieldStrategyConfig {
  id: SupportedYieldStrategyId;
  name: string;
  description: string;
  icon: string;
  color: string;
  risk: 'Low' | 'Medium' | 'High';
  networkStatus: string;
  isOctant?: boolean;
  isPaused?: boolean;
}

const IS_MAINNET = process.env.NEXT_PUBLIC_CHAIN_ENV === 'mainnet';
const BASE_STATUS = IS_MAINNET ? 'Live on Base' : 'Testnet (Base Sepolia)';

export const YIELD_STRATEGIES: YieldStrategyConfig[] = [
  {
    id: 'aave',
    name: 'Aave V3',
    description: 'Stable lending on Base with variable rates',
    icon: '🏦',
    color: 'bg-gradient-to-br from-blue-500 to-cyan-400',
    risk: 'Low',
    networkStatus: BASE_STATUS,
  },
  {
    id: 'morpho',
    name: 'Morpho Blue',
    description: 'Curated lending vaults on Base with optimized yields (~6.7% APY)',
    icon: '⚡',
    color: 'bg-gradient-to-br from-purple-500 to-pink-400',
    risk: 'Medium',
    networkStatus: BASE_STATUS,
  },
  {
    id: 'spark',
    name: 'Spark Protocol',
    description: 'Savings USDC (sUSDC) via Sky Savings Rate (~4.0% APY)',
    icon: '✨',
    color: 'bg-gradient-to-br from-indigo-500 to-blue-400',
    risk: 'Low',
    networkStatus: BASE_STATUS,
  },
  {
    id: 'pooltogether',
    name: 'PoolTogether V5',
    description: 'No-loss prize savings on Base. Keep 100% principal, win prizes every draw.',
    icon: '🎰',
    color: 'bg-gradient-to-br from-yellow-400 to-amber-600',
    risk: 'Low',
    networkStatus: BASE_STATUS,
  },
  {
    id: 'octant',
    name: 'Octant V2',
    description: 'Yield donating vaults supporting public goods. ~10% APY with social impact.',
    icon: '🌍',
    color: 'bg-gradient-to-br from-green-500 to-emerald-400',
    risk: 'Low',
    networkStatus: 'Preview',
    isOctant: true,
  },
  {
    id: 'lifiearn',
    name: 'LI.FI Earn',
    description: 'Cross-chain vault aggregator. Access 20+ protocols across 60+ chains with one-click deposits.',
    icon: '🔀',
    color: 'bg-gradient-to-br from-indigo-500 to-purple-600',
    risk: 'Low',
    networkStatus: 'Live Cross-Chain',
  },
  {
    id: 'fhenix',
    name: 'Fhenix FHE Vault',
    description:
      'Paused — this privacy vault is not taking deposits. Don’t send funds; a re-deploy is under review.',
    icon: '🔐',
    color: 'bg-gradient-to-br from-violet-500 to-indigo-600',
    risk: 'Low',
    networkStatus: 'Paused',
    isPaused: true,
  },
];

export function getStrategyById(id: SupportedYieldStrategyId): YieldStrategyConfig | undefined {
  return YIELD_STRATEGIES.find(s => s.id === id);
}
