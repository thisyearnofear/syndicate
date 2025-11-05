"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Users, TrendingUp, Heart, Trophy } from "lucide-react";
import SocialShare from "@/components/SocialShare";
import type { SyndicateInfo } from "@/domains/lottery/types";

interface SyndicateCardProps {
  syndicate: SyndicateInfo;
  onJoin?: (syndicateId: string) => void;
  onView?: (syndicateId: string) => void;
}

export default function SyndicateCard({ 
  syndicate, 
  onJoin,
  onView 
}: SyndicateCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate impact per member for display
  const impactPerMember = syndicate.totalImpact / Math.max(syndicate.membersCount, 1);

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
      {/* Header with icon and trending indicator */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
            {syndicate.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-white truncate max-w-[120px]">{syndicate.name}</h3>
            <p className="text-xs text-gray-400">{syndicate.cause.name}</p>
          </div>
        </div>
        
        {syndicate.isTrending && (
          <div className="flex items-center gap-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2 py-1 rounded-full border border-purple-500/30">
            <TrendingUp className="w-3 h-3 text-purple-400" />
            <span className="text-xs font-semibold text-purple-300">Trending</span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-300 mb-4 line-clamp-2">
        {syndicate.description}
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass p-2 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <Users className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-gray-400">Members</span>
          </div>
          <p className="font-bold text-white">{syndicate.membersCount.toLocaleString()}</p>
        </div>
        
        <div className="glass p-2 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <Heart className="w-3 h-3 text-red-400" />
            <span className="text-xs text-gray-400">Impact</span>
          </div>
          <p className="font-bold text-white">${(syndicate.totalImpact / 1000).toFixed(1)}k</p>
        </div>
        
        <div className="glass p-2 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <Trophy className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-gray-400">Tickets</span>
          </div>
          <p className="font-bold text-white">{syndicate.ticketsPooled.toLocaleString()}</p>
        </div>
        
        <div className="glass p-2 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <Heart className="w-3 h-3 text-green-400" />
            <span className="text-xs text-gray-400">Per Member</span>
          </div>
          <p className="font-bold text-white">${impactPerMember.toFixed(0)}</p>
        </div>
      </div>

      {/* Recent activity */}
      {syndicate.recentActivity.length > 0 && (
        <div className="mb-4">
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
      )}

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

      <style jsx>{`
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