// Enhanced Cause Impact Widget
// Consolidates impact display logic from multiple components
// Follows Core Principles: ENHANCEMENT FIRST, MODULAR, DRY

"use client";

import React from 'react';
import { type CauseImpact } from '@/services/impactService';
import { 
  Heart, 
  TrendingUp, 
  Users, 
  Target,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';

interface CauseImpactWidgetProps {
  cause: CauseImpact;
  showUserContribution?: boolean;
  showMilestones?: boolean;
  showRecentActivity?: boolean;
  compact?: boolean;
  className?: string;
}

export default function CauseImpactWidget({ 
  cause, 
  showUserContribution = true,
  showMilestones = true,
  showRecentActivity = false,
  compact = false,
  className = '' 
}: CauseImpactWidgetProps) {
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  if (compact) {
    return (
      <div className={`bg-gray-800/50 rounded-lg p-4 border border-gray-700 ${className}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{cause.icon}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-white">{cause.name}</h3>
            <p className="text-sm text-gray-400">{cause.description}</p>
          </div>
          {cause.trending && (
            <div className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Trending
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">
              {formatCurrency(cause.totalRaised)}
            </div>
            <div className="text-xs text-gray-400">Total Raised</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">{cause.totalImpact}</div>
            <div className="text-xs text-gray-400">Impact Created</div>
          </div>
        </div>

        {showUserContribution && cause.userContribution > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Your contribution:</span>
              <span className="text-purple-400 font-medium">
                {formatCurrency(cause.userContribution)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-400">Your impact:</span>
              <span className="text-green-400 font-medium">{cause.userImpact}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{cause.icon}</span>
          <div>
            <h3 className="text-xl font-bold text-white">{cause.name}</h3>
            <p className="text-gray-400">{cause.description}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {cause.trending && (
            <div className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trending
            </div>
          )}
        </div>
      </div>

      {/* Impact Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-900/30 rounded-lg p-4 border border-green-600/30">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-medium">Total Impact</span>
          </div>
          <div className="text-2xl font-bold text-white">{cause.totalImpact}</div>
          <div className="text-sm text-gray-400">
            from {formatCurrency(cause.totalRaised)} raised
          </div>
        </div>

        {showUserContribution && (
          <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600/30">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span className="text-purple-400 font-medium">Your Impact</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {cause.userContribution > 0 ? cause.userImpact : 'None yet'}
            </div>
            <div className="text-sm text-gray-400">
              from {formatCurrency(cause.userContribution)} contributed
            </div>
          </div>
        )}

        <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-600/30">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-blue-400" />
            <span className="text-blue-400 font-medium">Recent Activity</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {cause.recentActivity.length}
          </div>
          <div className="text-sm text-gray-400">actions today</div>
        </div>
      </div>

      {/* Milestones */}
      {showMilestones && cause.milestones.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Milestones
          </h4>
          <div className="space-y-3">
            {cause.milestones.map((milestone) => (
              <div key={milestone.id} className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{milestone.icon}</span>
                    <span className="font-medium text-white">{milestone.title}</span>
                    {milestone.completed && (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <span className="text-sm text-gray-400">
                    {formatCurrency(milestone.current)} / {formatCurrency(milestone.target)}
                  </span>
                </div>
                
                <p className="text-sm text-gray-400 mb-3">{milestone.description}</p>
                
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      milestone.completed 
                        ? 'bg-green-500' 
                        : 'bg-gradient-to-r from-blue-500 to-purple-500'
                    }`}
                    style={{ 
                      width: `${Math.min((milestone.current / milestone.target) * 100, 100)}%` 
                    }}
                  />
                </div>
                
                {milestone.completed && milestone.completedAt && (
                  <div className="mt-2 text-xs text-green-400">
                    ✅ Completed {formatTimeAgo(milestone.completedAt)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {showRecentActivity && cause.recentActivity.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Activity
          </h4>
          <div className="space-y-2">
            {cause.recentActivity.slice(0, 3).map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activity.type === 'donation' ? 'bg-green-600' :
                  activity.type === 'milestone' ? 'bg-yellow-600' :
                  'bg-blue-600'
                }`}>
                  {activity.type === 'donation' ? <Heart className="w-4 h-4 text-white" /> :
                   activity.type === 'milestone' ? <Target className="w-4 h-4 text-white" /> :
                   <Zap className="w-4 h-4 text-white" />}
                </div>
                
                <div className="flex-1">
                  <p className="text-sm text-white">{activity.description}</p>
                  <p className="text-xs text-gray-400">
                    {formatTimeAgo(activity.timestamp)}
                    {activity.amount && ` • ${formatCurrency(activity.amount)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}