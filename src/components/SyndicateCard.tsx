"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Users, TrendingUp, Heart, Trophy, Loader2 } from "lucide-react";
import SocialShare from "@/components/SocialShare";
import { useSyndicatePool } from "@/hooks/useSyndicatePool";
import type { SyndicateInfo } from "@/domains/lottery/types";
import type { SyndicatePool } from "@/domains/syndicate/types";

interface SyndicateCardProps {
  syndicate: SyndicateInfo;
  poolId?: string; // Optional pool ID for real data
  onJoin?: (syndicateId: string) => void;
  onView?: (syndicateId: string) => void;
}

export default function SyndicateCard({ 
  syndicate, 
  poolId,
  onJoin,
  onView 
}: SyndicateCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Fetch real pool data if poolId is provided
  const { pool: realPool, members, stats, isLoading, error } = useSyndicatePool(poolId || '');
  
  // Use real data if available, otherwise fall back to syndicate data
  const displayPool = realPool || {
    id: syndicate.id,
    name: syndicate.name,
    description: syndicate.description,
    memberCount: syndicate.membersCount,
    totalTickets: syndicate.ticketsPurchased,
    causeAllocation: syndicate.causePercentage,
    isActive: true,
  };
  
  // Calculate impact per member for display
  const impactPerMember = syndicate.totalImpact / Math.max(displayPool.memberCount, 1);
  
  // Show loading state
  if (poolId && isLoading) {
    return (
      <div className="glass-premium p-4 rounded-xl border border-white/20 w-full">
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
          <p className="text-gray-400 text-sm">Loading pool data...</p>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (poolId && error) {
    return (
      <div className="glass-premium p-4 rounded-xl border border-red-500/30 w-full">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
            <span className="text-red-400 text-lg">!</span>
          </div>
          <p className="text-red-400 text-sm text-center mb-2">Failed to load pool data</p>
          <p className="text-gray-500 text-xs text-center">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`
        glass-premium p-4 rounded-xl border transition-all duration-300
        ${isHovered ? 'ring-2 ring-white/50 scale-105' : ''}
        ${syndicate.isTrending ? 'border-purple-500/30 animate-pulse-slow' : 'border-white/20'}
        hover-lift w-full
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with icon and status indicators */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
            realPool 
              ? (displayPool.isActive ? 'bg-gradient-to-br from-green-500 to-emerald-500' : 'bg-gradient-to-br from-gray-500 to-gray-600')
              : 'bg-gradient-to-br from-purple-500 to-blue-500'
          }`}>
            {displayPool.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-white truncate max-w-[120px]">{displayPool.name}</h3>
            <p className="text-xs text-gray-400">{syndicate.cause.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-2 py-[2px] rounded-full bg-white/10 text-gray-300">
                {syndicate.model === 'altruistic' ? `Altruistic • ${displayPool.causeAllocation}%` : 'Pure'}
              </span>
              {realPool && (
                <span className={`text-[10px] px-2 py-[2px] rounded-full text-xs ${
                  displayPool.isActive 
                    ? 'bg-green-500/20 text-green-300' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {displayPool.isActive ? 'Live' : 'Ended'}
                </span>
              )}
              <span className="text-[10px] px-2 py-[2px] rounded-full bg-white/10 text-yellow-300">
                {new Date(syndicate.executionDate).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {syndicate.isTrending && (
            <div className="flex items-center gap-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2 py-1 rounded-full border border-purple-500/30 mr-1">
              <TrendingUp className="w-3 h-3 text-purple-400" />
              <span className="text-xs font-semibold text-purple-300">Trending</span>
            </div>
          )}
          {realPool && (
            <div className="flex items-center gap-1 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-2 py-1 rounded-full border border-blue-500/30">
              <span className="text-xs font-semibold text-blue-300">On-chain</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 mb-4 line-clamp-2">
        {syndicate.description}
      </p>

      {/* Stats grid - enhanced with real data */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass p-2 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <Users className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-gray-400">Members</span>
          </div>
          <p className="font-bold text-white">
            {displayPool.memberCount.toLocaleString()}
            {realPool && members && (
              <span className="text-xs text-gray-400 ml-1">
                ({members.length} on-chain)
              </span>
            )}
          </p>
        </div>
        
        <div className="glass p-2 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <Heart className="w-3 h-3 text-red-400" />
            <span className="text-xs text-gray-400">Impact</span>
          </div>
          <p className="font-bold text-white">
            ${syndicate.totalImpact.toLocaleString()}
            {realPool && (
              <span className="text-xs text-gray-400 ml-1 block">
                ${(parseFloat(stats?.totalPooled || '0') / 1000).toFixed(1)}k pooled
              </span>
            )}
          </p>
        </div>
        
        <div className="glass p-2 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <Trophy className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-gray-400">Tickets</span>
          </div>
          <p className="font-bold text-white">
            {syndicate.ticketsPurchased.toLocaleString()}
            {realPool && (
              <span className="text-xs text-gray-400 ml-1 block">
                {displayPool.totalTickets.toLocaleString()} total
              </span>
            )}
          </p>
        </div>
        
        <div className="glass p-2 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <Heart className="w-3 h-3 text-green-400" />
            <span className="text-xs text-gray-400">Per Member</span>
          </div>
          <p className="font-bold text-white">
            ${impactPerMember.toFixed(0)}
            {realPool && stats && (
              <span className="text-xs text-gray-400 ml-1 block">
                ${parseFloat(stats.avgContribution).toFixed(0)} avg
              </span>
            )}
          </p>
        </div>
        
        <div className="glass p-2 rounded-lg col-span-2">
          <div className="flex items-center gap-1 mb-1">
            <Trophy className="w-3 h-3 text-blue-300" />
            <span className="text-xs text-gray-400">Cutoff</span>
          </div>
          <p className="font-bold text-white">
            {new Date(syndicate.cutoffDate).toLocaleString()}
            {realPool && (
              <span className="text-xs text-gray-400 ml-2">
                {displayPool.isActive ? 'Active' : 'Inactive'}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Recent activity and real members list */}
      <div className="mb-4">
        {realPool && members && members.length > 0 ? (
          <div>
            <div className="flex items-center gap-1 mb-2">
              <Users className="w-3 h-3 text-blue-400" />
              <span className="text-xs font-semibold text-gray-400">Recent Members</span>
              <span className="text-xs text-gray-500 ml-auto">({members.length})</span>
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {members.slice(0, 3).map((member, index) => (
                <div key={member.address} className="flex justify-between text-xs">
                  <span className="text-gray-400 truncate max-w-[80px]">
                    {member.address.slice(0, 6)}...{member.address.slice(-4)}
                  </span>
                  <span className="text-gray-500">
                    ${(parseFloat(member.amount)).toFixed(0)}
                  </span>
                </div>
              ))}
              {members.length > 3 && (
                <div className="text-xs text-gray-500 text-center pt-1">
                  +{members.length - 3} more members
                </div>
              )}
            </div>
          </div>
        ) : syndicate.recentActivity.length > 0 ? (
          <div>
            <div className="flex items-center gap-1 mb-2">
              <TrendingUp className="w-3 h-3 text-purple-400" />
              <span className="text-xs font-semibold text-gray-400">Recent Activity</span>
            </div>
            <div className="space-y-1">
              {syndicate.recentActivity.slice(0, 2).map((activity, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-gray-400">
                    {activity.count} {activity.type}{activity.count !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-500">{activity.timeframe}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Action buttons with progressive disclosure */}
      <div className="flex flex-col gap-2">
        <Button 
          variant="default" 
          size="sm" 
          className="flex-1 text-xs"
          onClick={() => onJoin?.(syndicate.id)}
        >
          Join Syndicate
        </Button>
        
        {/* Advanced options for yield strategies */}
        <div className="flex gap-1">
          <SocialShare 
            url={`${typeof window !== 'undefined' ? window.location.origin : ''}/syndicate/${syndicate.id}`}
            title={`Join ${syndicate.name}`}
            description={syndicate.description}
          />
          <Button 
            variant="ghost" 
            size="sm" 
            className="px-2 flex-1"
            onClick={() => onView?.(syndicate.id)}
          >
            <Trophy className="w-3 h-3 mr-1" />
            <span className="text-xs">Details</span>
          </Button>
          
          {/* Yield strategy indicator */}
          {syndicate.vaultStrategy && (
            <div className="flex items-center justify-center px-2 py-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-md border border-purple-500/30">
              <span className="text-xs text-purple-300">Yield</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .hover-lift {
          transition: transform 0.2s ease-in-out;
        }
        .hover-lift:hover {
          transform: translateY(-4px);
        }
        .glass {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
        }
        .glass-premium {
          background: linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
}