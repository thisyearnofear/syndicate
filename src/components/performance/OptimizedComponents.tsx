"use client";

/**
 * ENHANCEMENT FIRST: Optimized Component System
 * 
 * Memoized versions of performance-critical components
 * Reduces unnecessary re-renders and improves overall performance
 * 
 * Core Principles:
 * - PERFORMANT: React.memo with custom comparison functions
 * - DRY: Reusable optimization patterns
 * - CLEAN: Clear performance boundaries
 */

import React, { memo, useMemo, useCallback } from 'react';
import { useOptimizedCounter } from '@/hooks/performance/useOptimizedAnimation';
import { useJackpotData, useCountdownData, useActivityData, useStatsData } from '@/hooks/performance/useUnifiedData';
import { performanceBudgetManager } from '@/services/performance/PerformanceBudgetManager';

// PERFORMANT: Memoized jackpot display with optimized counter
interface OptimizedJackpotProps {
  className?: string;
  priority?: 'high' | 'medium' | 'low';
}

const OptimizedJackpotComponent = memo(({ className = '', priority = 'high' }: OptimizedJackpotProps) => {
  const { data: jackpotData, loading, error } = useJackpotData({ 
    frequency: 30000,
    priority,
  });

  const { timeRemaining } = useCountdownData({
    frequency: 1000,
    priority: 'high',
  });

  // PERFORMANT: Parse jackpot amount for counter animation
  const targetAmount = useMemo(() => {
    if (!jackpotData?.prizeUsd) return 0;
    return parseFloat(jackpotData.prizeUsd.replace(/[^0-9.-]+/g, '')) || 0;
  }, [jackpotData?.prizeUsd]);

  // PERFORMANT: Optimized counter animation
  const { value: displayAmount, isAnimating } = useOptimizedCounter(
    targetAmount,
    2000,
    {
      id: 'jackpot-counter',
      priority,
      enabled: !loading && !error,
      respectReducedMotion: true,
    }
  );

  // PERFORMANT: Memoized urgency indicator
  const urgencyIndicator = useMemo(() => {
    if (!timeRemaining) return null;
    
    const totalSeconds = timeRemaining.timeRemaining / 1000;
    if (totalSeconds <= 3600) { // Less than 1 hour
      return <span className="text-red-400 animate-pulse">🔥 DRAW NOW!</span>;
    } else if (totalSeconds <= 7200) { // Less than 2 hours
      return <span className="text-orange-400 animate-pulse">⚡ Almost Time!</span>;
    }
    return null;
  }, [timeRemaining]);

  // PERFORMANT: Device-aware styling
  const deviceCapabilities = useMemo(() => performanceBudgetManager.getStatus().capabilities, []);
  const supportsAdvancedEffects = performanceBudgetManager.supportsAdvancedEffects();

  if (loading) {
    return (
      <div className={`bg-gray-900/50 rounded-2xl p-6 border border-gray-700/50 backdrop-blur-md ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded mb-2"></div>
          <div className="h-12 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-900/50 rounded-2xl p-6 border border-red-700/50 backdrop-blur-md ${className}`}>
        <div className="text-red-400 text-center">
          <div className="text-lg font-semibold mb-2">⚠️ Connection Issue</div>
          <div className="text-sm">Retrying...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative bg-gradient-to-br from-purple-900/80 to-blue-900/80 rounded-2xl p-6 border-2 border-purple-500/30 backdrop-blur-md transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/20 overflow-hidden ${
        isAnimating && supportsAdvancedEffects
          ? "scale-105 border-green-400 shadow-lg shadow-green-400/30 ring-2 ring-green-400/30"
          : ""
      } ${className}`}
    >
      {/* PERFORMANT: Conditional advanced effects */}
      {supportsAdvancedEffects && isAnimating && (
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 animate-pulse"></div>
      )}

      <div className="relative z-10 text-center">
        <div className="text-lg font-semibold text-gray-300 mb-2">
          Current Jackpot
        </div>
        
        <div className={`text-3xl md:text-4xl font-black transition-all duration-500 ${
          isAnimating ? "text-green-400" : "text-white"
        }`}>
          ${displayAmount.toLocaleString('en-US', { 
            minimumFractionDigits: 0,
            maximumFractionDigits: 0 
          })}
        </div>

        {urgencyIndicator && (
          <div className="mt-3 text-sm">
            {urgencyIndicator}
          </div>
        )}

        {timeRemaining && (
          <div className="mt-2 text-gray-400 text-sm">
            {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m remaining
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // PERFORMANT: Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.className === nextProps.className &&
    prevProps.priority === nextProps.priority
  );
});

OptimizedJackpotComponent.displayName = 'OptimizedJackpot';

// PERFORMANT: Memoized activity feed
interface OptimizedActivityFeedProps {
  className?: string;
  maxItems?: number;
}

const OptimizedActivityFeedComponent = memo(({
  className = '',
  maxItems = 5
}: OptimizedActivityFeedProps) => {
  const { activities, loading, error } = useActivityData({
    frequency: 10000, // Less frequent for activity feed
    priority: 'medium',
  });

  // PERFORMANT: Memoized activity list
  const displayActivities = useMemo(() => {
    if (!activities || !Array.isArray(activities)) return [];
    return activities.slice(0, maxItems);
  }, [activities, maxItems]);

  if (loading) {
    return (
      <div className={`bg-gray-900/50 rounded-2xl p-4 border border-gray-700/50 backdrop-blur-md ${className}`}>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-4 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900/50 rounded-2xl p-4 border border-gray-700/50 backdrop-blur-md ${className}`}>
      <div className="text-sm font-semibold text-gray-300 mb-3">
        🔥 Live Activity
      </div>
      
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {displayActivities.length > 0 ? (
          displayActivities.map((activity, index) => (
            <div key={`${activity.id || index}`} className="text-xs text-gray-400 flex items-center gap-2">
              <span className="text-green-400">●</span>
              <span className="flex-1 truncate">{activity.message || 'Recent activity'}</span>
              <span className="text-gray-500">now</span>
            </div>
          ))
        ) : (
          <div className="text-xs text-gray-500 text-center py-2">
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.className === nextProps.className &&
    prevProps.maxItems === nextProps.maxItems
  );
});

OptimizedActivityFeedComponent.displayName = 'OptimizedActivityFeed';

// PERFORMANT: Memoized stats display
interface OptimizedStatsProps {
  className?: string;
  layout?: 'grid' | 'horizontal';
}

const OptimizedStatsComponent = memo(({
  className = '',
  layout = 'grid'
}: OptimizedStatsProps) => {
  const { stats, loading } = useStatsData({
    frequency: 60000, // 1 minute for stats
    priority: 'low',
  });

  // PERFORMANT: Memoized stats data
  const statsData = useMemo(() => [
    {
      label: 'Tickets Today',
      value: stats?.ticketsToday?.toLocaleString() || '0',
      color: 'text-green-400',
    },
    {
      label: 'Active Players',
      value: stats?.onlineUsers || '0',
      color: 'text-blue-400',
    },
    {
      label: 'Weekly Wins',
      value: `$${((stats?.weeklyWins || 0) / 1000).toFixed(1)}K`,
      color: 'text-yellow-400',
    },
    {
      label: 'Syndicates',
      value: stats?.activeSyndicates || '0',
      color: 'text-purple-400',
    },
  ], [stats]);

  if (loading) {
    return (
      <div className={`bg-gray-900/50 rounded-2xl p-4 border border-gray-700/50 backdrop-blur-md ${className}`}>
        <div className="animate-pulse">
          <div className={`grid ${layout === 'grid' ? 'grid-cols-2 gap-4' : 'grid-cols-4 gap-2'}`}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900/50 rounded-2xl p-4 border border-gray-700/50 backdrop-blur-md ${className}`}>
      <div className={`grid ${layout === 'grid' ? 'grid-cols-2 gap-4' : 'grid-cols-4 gap-2'}`}>
        {statsData.map((stat, index) => (
          <div key={stat.label} className="text-center">
            <div className={`font-semibold ${stat.color} ${layout === 'grid' ? 'text-lg' : 'text-sm'}`}>
              {stat.value}
            </div>
            <div className={`text-gray-400 ${layout === 'grid' ? 'text-sm' : 'text-xs'}`}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.className === nextProps.className &&
    prevProps.layout === nextProps.layout
  );
});

OptimizedStatsComponent.displayName = 'OptimizedStats';

// MODULAR: Export optimized components
export const OptimizedJackpot = OptimizedJackpotComponent;
export const OptimizedActivityFeed = OptimizedActivityFeedComponent;
export const OptimizedStats = OptimizedStatsComponent;