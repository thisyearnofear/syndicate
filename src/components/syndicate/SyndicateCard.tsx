/**
 * SyndicateCard Component
 * 
 * Card for displaying syndicate in discovery/browse views.
 * Shows key info and allows quick join.
 */

'use client';

import Link from 'next/link';
import { 
  Users, 
  Trophy, 
  Heart, 
  Shield,
  Share2,
  Coins
} from 'lucide-react';

type PoolType = 'safe' | 'splits' | 'pooltogether' | 'fhenix';
type VaultStrategy = 'aave' | 'morpho' | 'spark' | 'pooltogether' | 'octant' | 'uniswap' | 'fhenix' | 'lifiearn';

interface SyndicateCardData {
  id: string;
  name: string;
  description: string;
  cause: string;
  poolType: PoolType;
  vaultStrategy?: VaultStrategy;
  membersCount: number;
  ticketsPooled: number;
  totalImpact: number;
  causePercentage: number;
  isTrending: boolean;
}

interface SyndicateCardProps {
  syndicate: SyndicateCardData;
  compact?: boolean;
}

export function SyndicateCard({ syndicate, compact = false }: SyndicateCardProps) {
  const getPoolTypeBadge = (poolType: PoolType) => {
    const badges: Record<PoolType, { bg: string; text: string; icon: typeof Shield }> = {
      safe: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Shield },
      splits: { bg: 'bg-green-500/20', text: 'text-green-400', icon: Share2 },
      pooltogether: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: Coins },
      fhenix: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Shield },
    };
    const badge = badges[poolType] ?? badges['safe'];
    const Icon = badge.icon;
    return (
      <span className={`${badge.bg} ${badge.text} text-xs px-2 py-1 rounded-full flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {poolType === 'safe' ? 'Safe' : poolType === 'splits' ? 'Splits' : poolType === 'fhenix' ? 'FHE 🔒' : 'PT'}
      </span>
    );
  };

  const getStrategyLabel = (strategy?: VaultStrategy) => {
    if (!strategy) return null;
    const vaultLabels: Record<VaultStrategy, string> = {
      aave: 'Aave',
      morpho: 'Morpho',
      spark: 'Spark',
      pooltogether: 'PoolTogether',
      octant: 'Octant',
      uniswap: 'Uniswap',
      fhenix: 'FHE Vault',
      lifiearn: 'LI.FI Earn',
    };
    return vaultLabels[strategy];
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (compact) {
    return (
      <Link href={`/syndicate?id=${syndicate.id}`} className="block">
        <div className="glass-premium rounded-xl p-4 border border-white/20 hover:border-white/40 transition-all duration-300 cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-white truncate">{syndicate.name}</h3>
            {getPoolTypeBadge(syndicate.poolType)}
          </div>
          <p className="text-gray-400 text-sm mb-3 line-clamp-2">{syndicate.description}</p>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4 text-blue-400" />
              {formatNumber(syndicate.membersCount)}
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="w-4 h-4 text-yellow-400" />
              {formatNumber(syndicate.ticketsPooled)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4 text-red-400" />
              {syndicate.causePercentage}%
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/syndicate?id=${syndicate.id}`} className="block">
      <div className="glass-premium rounded-2xl p-5 border border-white/20 hover:border-white/40 transition-all duration-300 cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-lg font-bold">
              {syndicate.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-white">{syndicate.name}</h3>
              <p className="text-blue-300 text-sm">{syndicate.cause}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {syndicate.isTrending && (
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full">
                Trending
              </span>
            )}
            {getPoolTypeBadge(syndicate.poolType)}
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{syndicate.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{formatNumber(syndicate.membersCount)}</p>
            <p className="text-xs text-gray-400">Members</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{formatNumber(syndicate.ticketsPooled)}</p>
            <p className="text-xs text-gray-400">Tickets</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-400">${formatNumber(syndicate.totalImpact)}</p>
            <p className="text-xs text-gray-400">Impact</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-400">{syndicate.causePercentage}%</p>
            <p className="text-xs text-gray-400">To Cause</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          {syndicate.vaultStrategy && (
            <span className="bg-white/10 text-gray-300 text-xs px-2 py-1 rounded">
              {getStrategyLabel(syndicate.vaultStrategy)} Yield
            </span>
          )}
          <span className="bg-white/10 text-gray-300 text-xs px-2 py-1 rounded">
            {syndicate.causePercentage}% Impact
          </span>
        </div>
      </div>
    </Link>
  );
}

export default SyndicateCard;
