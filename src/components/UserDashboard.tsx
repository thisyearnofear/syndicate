"use client";

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useSolanaWallet } from '@/providers/SolanaWalletProvider';
import { useUserStatsDisplay } from '@/providers/MegapotProvider';
import { useCrossChain } from '@/providers/CrossChainProvider';
import { impactService, type UserImpactStats, type CauseImpact, type Achievement } from '@/services/impactService';
import CauseImpactWidget from '@/components/impact/CauseImpactWidget';
import { 
  Trophy, 
  Ticket, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Heart, 
  Zap, 
  Calendar,
  Award,
  Target,
  Gift,
  ExternalLink
} from 'lucide-react';

// Remove duplicate Achievement interface - using one from impactService

interface UserDashboardProps {
  className?: string;
}

export default function UserDashboard({ className = '' }: UserDashboardProps) {
  const { address } = useAccount();
  const { connected: isSolanaConnected, publicKey } = useSolanaWallet();
  const { totalTickets, totalSpentFormatted, recentPurchases, isLoading } = useUserStatsDisplay();
  const { activeTransactions } = useCrossChain();
  
  const [userLevel, setUserLevel] = useState(1);
  const [experiencePoints, setExperiencePoints] = useState(0);
  const [nextLevelXP, setNextLevelXP] = useState(100);
  const [userImpactStats, setUserImpactStats] = useState<UserImpactStats | null>(null);
  const [causeImpacts, setCauseImpacts] = useState<CauseImpact[]>([]);
  const [isLoadingImpact, setIsLoadingImpact] = useState(true);

  // Load real impact data and user stats
  useEffect(() => {
    const loadImpactData = async () => {
      setIsLoadingImpact(true);
      try {
        // Load user impact stats
        const stats = await impactService.getUserImpactStats(address);
        setUserImpactStats(stats);

        // Load all cause impacts
        const causes = await impactService.getAllCauseImpacts();
        setCauseImpacts(causes);

        // Calculate level based on real contribution and activity
        const baseXP = totalTickets * 10;
        const crossChainBonus = activeTransactions.length * 25;
        const solanaBonus = isSolanaConnected ? 50 : 0;
        const impactBonus = stats.totalContributed * 4;
        const achievementBonus = stats.achievements.length * 50;
        const totalXP = baseXP + crossChainBonus + solanaBonus + impactBonus + achievementBonus;
        
        setExperiencePoints(totalXP);
        
        const level = Math.floor(totalXP / 100) + 1;
        setUserLevel(level);
        setNextLevelXP((level * 100) - totalXP);
        
      } catch (error) {
        console.error('Failed to load impact data:', error);
      } finally {
        setIsLoadingImpact(false);
      }
    };

    loadImpactData();
  }, [address, totalTickets, activeTransactions.length, isSolanaConnected]);

  const unlockedAchievements = userImpactStats?.achievements.filter(a => a.unlocked) || [];
  const progressAchievements = userImpactStats?.achievements.filter(a => !a.unlocked && a.progress !== undefined) || [];

  if (isLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-700 rounded w-2/3"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* User Profile Header */}
      <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-purple-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Anonymous'}
              </h2>
              <p className="text-purple-200">Level {userLevel} Lottery Player</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-yellow-300">
              {userImpactStats?.totalContributed || 0}
            </div>
            <div className="text-sm text-purple-200">Impact Score</div>
          </div>
        </div>
        
        {/* Experience Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Experience Points</span>
            <span>{experiencePoints} XP</span>
          </div>
          <div className="w-full bg-purple-800/50 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${((experiencePoints % 100) / 100) * 100}%` }}
            />
          </div>
          <div className="text-xs text-purple-200 mt-1">
            {nextLevelXP} XP to next level
          </div>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>EVM Connected</span>
          </div>
          {isSolanaConnected && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Solana Connected</span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${activeTransactions.length > 0 ? 'bg-purple-400' : 'bg-gray-400'}`}></div>
            <span>Cross-Chain {activeTransactions.length > 0 ? 'Active' : 'Ready'}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Ticket className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">{totalTickets}</span>
          </div>
          <div className="text-sm text-gray-400">Total Tickets</div>
          <div className="text-xs text-green-400 mt-1">+{recentPurchases.length} this week</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-green-400" />
            <span className="text-2xl font-bold text-white">{totalSpentFormatted}</span>
          </div>
          <div className="text-sm text-gray-400">Total Invested</div>
          <div className="text-xs text-blue-400 mt-1">Across all chains</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-8 h-8 text-purple-400" />
            <span className="text-2xl font-bold text-white">{activeTransactions.length}</span>
          </div>
          <div className="text-sm text-gray-400">Cross-Chain Txs</div>
          <div className="text-xs text-purple-400 mt-1">Multi-chain access</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Heart className="w-8 h-8 text-red-400" />
            <span className="text-2xl font-bold text-white">
              {userImpactStats?.totalContributed || 0}
            </span>
          </div>
          <div className="text-sm text-gray-400">Impact Points</div>
          <div className="text-xs text-red-400 mt-1">Causes supported</div>
        </div>
      </div>

      {/* Achievements Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Award className="w-5 h-5" />
            <span>Achievements</span>
          </h3>
          <span className="text-sm text-gray-400">
            {unlockedAchievements.length} / {(userImpactStats?.achievements.length || 0)} unlocked
          </span>
        </div>
        
        {/* Unlocked Achievements */}
        {unlockedAchievements.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-green-400 mb-3">🏆 Unlocked</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unlockedAchievements.map((achievement) => (
                <div key={achievement.id} className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <div className="text-green-400">{achievement.icon}</div>
                    <div className="flex-1">
                      <h5 className="font-medium text-green-300 text-sm">{achievement.title}</h5>
                      <p className="text-xs text-green-200/80">{achievement.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Progress Achievements */}
        {progressAchievements.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-yellow-400 mb-3">🎯 In Progress</h4>
            <div className="space-y-3">
              {progressAchievements.map((achievement) => (
                <div key={achievement.id} className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="text-gray-400">{achievement.icon}</div>
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-300 text-sm">{achievement.title}</h5>
                      <p className="text-xs text-gray-400">{achievement.description}</p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {achievement.progress} / {achievement.maxProgress}
                    </div>
                  </div>
                  {achievement.progress !== undefined && achievement.maxProgress && (
                    <div className="w-full bg-gray-600 rounded-full h-1.5">
                      <div 
                        className="bg-yellow-400 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {recentPurchases.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Recent Activity</span>
          </h3>
          <div className="space-y-3">
            {recentPurchases.slice(0, 5).map((purchase, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Ticket className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">
                      Purchased {purchase.ticketsPurchased} ticket{purchase.ticketsPurchased > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      Round #{purchase.jackpotRoundId} • Tickets #{purchase.startTicket}-{purchase.endTicket}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white text-sm">
                    ${(purchase.ticketsPurchasedTotalBps / 1000000).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">USDC</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cause Impact Section */}
      {!isLoadingImpact && causeImpacts.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Heart className="w-6 h-6 text-red-400" />
              Your Impact
            </h3>
            <div className="text-sm text-gray-400">
              {userImpactStats?.causesSupported || 0} causes supported
            </div>
          </div>

          {/* User's Active Causes */}
          <div className="grid md:grid-cols-2 gap-4">
            {causeImpacts
              .filter(cause => cause.userContribution > 0)
              .map(cause => (
                <CauseImpactWidget
                  key={cause.id}
                  cause={cause}
                  compact={true}
                  showUserContribution={true}
                  showMilestones={false}
                />
              ))}
          </div>

          {/* Trending Causes */}
          {causeImpacts.some(cause => cause.trending && cause.userContribution === 0) && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-400" />
                Trending Causes
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                {causeImpacts
                  .filter(cause => cause.trending && cause.userContribution === 0)
                  .slice(0, 2)
                  .map(cause => (
                    <CauseImpactWidget
                      key={cause.id}
                      cause={cause}
                      compact={true}
                      showUserContribution={false}
                      showMilestones={false}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
          <Target className="w-5 h-5" />
          <span>Quick Actions</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg transition-colors text-left">
            <Gift className="w-6 h-6 mb-2" />
            <h4 className="font-medium mb-1">Buy More Tickets</h4>
            <p className="text-sm text-blue-200">Increase your chances to win</p>
          </button>
          
          <button className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg transition-colors text-left">
            <Users className="w-6 h-6 mb-2" />
            <h4 className="font-medium mb-1">Create Syndicate</h4>
            <p className="text-sm text-purple-200">Team up with friends</p>
          </button>
          
          <button className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg transition-colors text-left">
            <Heart className="w-6 h-6 mb-2" />
            <h4 className="font-medium mb-1">Support New Causes</h4>
            <p className="text-sm text-green-200">Discover more ways to help</p>
          </button>
        </div>
      </div>
    </div>
  );
}