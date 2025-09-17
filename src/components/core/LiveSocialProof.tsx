"use client";

import React, { useState, useEffect, memo, useMemo } from "react";
import { useActivityData, useStatsData } from "@/hooks/performance/useUnifiedData";
import { performanceBudgetManager } from "@/services/performance/PerformanceBudgetManager";

/**
 * ENHANCEMENT FIRST: Optimized LiveSocialProof
 * 
 * Performance-optimized social proof with unified data service
 * Respects device capabilities and reduces unnecessary updates
 * 
 * Core Principles:
 * - PERFORMANT: Unified data service, memoized components
 * - DRY: Single data source, no duplicate polling
 * - CLEAN: Clear performance boundaries
 */

interface SocialProofItem {
  id: string;
  type: 'ticket_purchase' | 'syndicate_join' | 'win' | 'donation';
  message: string;
  timestamp: Date;
  amount?: string;
}

const LiveSocialProofComponent = memo(() => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // PERFORMANT: Use unified data service
  const { activities } = useActivityData({
    frequency: 8000, // Slower refresh for better performance
    priority: 'medium',
  });
  
  const { stats } = useStatsData({
    frequency: 30000, // Much slower for stats
    priority: 'low',
  });

  // PERFORMANT: Check device capabilities
  const deviceCapabilities = useMemo(() => performanceBudgetManager.getStatus().capabilities, []);
  const rotationSpeed = deviceCapabilities.tier === 'high' ? 3000 : 5000; // Slower on low-end devices

  // PERFORMANT: Memoized current activity
  const currentActivity = useMemo(() => {
    if (!activities || activities.length === 0) return null;
    return activities[currentIndex] || null;
  }, [activities, currentIndex]);

  // PERFORMANT: Optimized rotation with device-aware timing
  useEffect(() => {
    if (!activities || activities.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activities.length);
    }, rotationSpeed);

    return () => clearInterval(interval);
  }, [activities?.length, rotationSpeed]);

  // PERFORMANT: Memoized stats display
  const statsDisplay = useMemo(() => {
    if (!stats) return null;
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="text-green-400">
          <div className="font-semibold">{(stats.ticketsToday || 0).toLocaleString()} tickets</div>
          <div className="text-gray-400">sold today</div>
        </div>
        <div className="text-blue-400">
          <div className="font-semibold">{stats.activeSyndicates || 0} syndicates</div>
          <div className="text-gray-400">active now</div>
        </div>
        <div className="text-yellow-400">
          <div className="font-semibold">${((stats.weeklyWins || 0) / 1000).toFixed(1)}K won</div>
          <div className="text-gray-400">this week</div>
        </div>
        <div className="text-purple-400">
          <div className="font-semibold flex items-center gap-1">
            {deviceCapabilities.tier !== 'low' && (
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            )}
            {stats.onlineUsers || 0}
          </div>
          <div className="text-gray-400">online now</div>
        </div>
      </div>
    );
  }, [stats, deviceCapabilities.tier]);

  return (
    <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-700/50 backdrop-blur-md">
      <div className="text-center space-y-4">
        
        {/* PERFORMANT: Live activity ticker */}
        <div className="text-lg font-semibold text-white mb-4">🔥 Live Activity</div>
        
        {/* PERFORMANT: Optimized rotating activity feed */}
        <div className="h-12 flex items-center justify-center">
          <div className="text-sm text-gray-300 transition-opacity duration-500">
            {currentActivity ? (
              <div className="flex items-center gap-2">
                <span className="text-green-400">●</span>
                <span className="truncate max-w-xs">{currentActivity.message}</span>
                {currentActivity.amount && (
                  <span className="text-yellow-400 font-semibold">{currentActivity.amount}</span>
                )}
                <span className="text-gray-500 text-xs">now</span>
              </div>
            ) : (
              <div className="text-gray-500">Loading activity...</div>
            )}
          </div>
        </div>

        {/* PERFORMANT: Memoized statistics */}
        {statsDisplay}

        {/* PERFORMANT: Conditional recent wins (only on high-end devices) */}
        {deviceCapabilities.tier === 'high' && (
          <div className="text-xs text-gray-400 border-t border-gray-700/50 pt-3">
            💰 Recent wins: $1,247 • $892 • $2,156 • $445 • $1,089
          </div>
        )}
      </div>
    </div>
  );
}, () => true); // Pure component - only re-render when forced

LiveSocialProofComponent.displayName = 'LiveSocialProof';

export const LiveSocialProof = LiveSocialProofComponent;
export default LiveSocialProof;