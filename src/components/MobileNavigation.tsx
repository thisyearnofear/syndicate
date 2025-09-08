"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useSolanaWallet } from '@/providers/SolanaWalletProvider';
import { useUserStatsDisplay } from '@/providers/MegapotProvider';
import { impactService, type UserImpactStats } from '@/services/impactService';
import { useGestures, mobileGestureService, MobileGestureService } from '@/services/mobileGestureService';
import SwipeableNavigation, { useSwipeableTabNavigation } from '@/components/mobile/SwipeableNavigation';
import { 
  Menu, 
  X, 
  Home, 
  Ticket, 
  Trophy, 
  Users, 
  Settings, 
  HelpCircle,
  Wallet,
  Zap,
  Search,
  Bell,
  User,
  TrendingUp,
  Heart,
  ExternalLink
} from 'lucide-react';

interface MobileNavigationProps {
  activeTab: "lottery" | "transactions" | "dashboard";
  onTabChange: (tab: "lottery" | "transactions" | "dashboard") => void;
  className?: string;
}

export default function MobileNavigation({ activeTab, onTabChange, className = '' }: MobileNavigationProps) {
  const { address, isConnected } = useAccount();
  const { connected: isSolanaConnected, publicKey } = useSolanaWallet();
  const { totalTickets, totalSpentFormatted } = useUserStatsDisplay();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userImpactStats, setUserImpactStats] = useState<UserImpactStats | null>(null);
  const [isSwipeEnabled, setIsSwipeEnabled] = useState(true);
  const navigationRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load user impact stats
  useEffect(() => {
    const loadUserStats = async () => {
      if (address) {
        try {
          const stats = await impactService.getUserImpactStats(address);
          setUserImpactStats(stats);
        } catch (error) {
          console.error('Failed to load user stats:', error);
        }
      }
    };
    loadUserStats();
  }, [address]);

  const navigationItems: Array<{
    id: "lottery" | "transactions" | "dashboard";
    label: string;
    icon: React.JSX.Element;
    description: string;
  }> = [
    {
      id: 'lottery',
      label: 'Lottery',
      icon: <Ticket className="w-5 h-5" />,
      description: 'Buy tickets & play'
    },
    {
      id: 'transactions',
      label: 'History',
      icon: <Trophy className="w-5 h-5" />,
      description: 'Transaction history'
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <TrendingUp className="w-5 h-5" />,
      description: 'Your stats & achievements'
    }
  ];

  const quickActions = [
    {
      id: 'buy-tickets',
      label: 'Buy Tickets',
      icon: <Ticket className="w-4 h-4" />,
      action: () => onTabChange('lottery'),
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      id: 'view-stats',
      label: 'View Stats',
      icon: <TrendingUp className="w-4 h-4" />,
      action: () => onTabChange('dashboard'),
      color: 'bg-purple-600 hover:bg-purple-700'
    },
    {
      id: 'join-syndicate',
      label: 'Join Syndicate',
      icon: <Users className="w-4 h-4" />,
      action: () => onTabChange('dashboard'),
      color: 'bg-green-600 hover:bg-green-700'
    }
  ];

  // Enhanced navigation with gesture support
  const tabs = ['lottery', 'transactions', 'dashboard'] as const;
  const { swipeToNextTab, swipeToPrevTab } = useSwipeableTabNavigation(
    tabs,
    activeTab,
    onTabChange
  );

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    // Add haptic feedback for menu toggle
    MobileGestureService.triggerHapticFeedback('medium');
  };

  const handleNavigation = (tabId: "lottery" | "transactions" | "dashboard") => {
    onTabChange(tabId);
    setIsMenuOpen(false);
    // Add haptic feedback for navigation
    MobileGestureService.triggerHapticFeedback('light');
  };

  // Handle swipe gestures for tab navigation
  const handleSwipeLeft = () => {
    if (!isMenuOpen) {
      swipeToNextTab();
    }
  };

  const handleSwipeRight = () => {
    if (!isMenuOpen) {
      swipeToPrevTab();
    }
  };

  const handleSwipeDown = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Navigation Bar with Gesture Support */}
      <SwipeableNavigation
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
        onSwipeDown={handleSwipeDown}
        disabled={isMenuOpen}
        className={`lg:hidden bg-gray-800 border-t border-gray-700 ${className}`}
      >
        {/* Bottom Navigation */}
        <div className="flex items-center justify-around py-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors ${
                activeTab === item.id
                  ? 'text-blue-400 bg-blue-900/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
          
          {/* Menu Button */}
          <button
            onClick={toggleMenu}
            className="flex flex-col items-center space-y-1 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          >
            <Menu className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </SwipeableNavigation>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={toggleMenu}>
          <div className="absolute bottom-0 left-0 right-0 bg-gray-800 rounded-t-xl p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Menu</h2>
              <button
                onClick={toggleMenu}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Enhanced User Info with Real Impact Data */}
            {isConnected && (
              <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                    </p>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span>EVM Connected</span>
                      {isSolanaConnected && (
                        <>
                          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          <span>Solana Connected</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-600/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-white">{totalTickets}</div>
                    <div className="text-xs text-gray-400">Tickets</div>
                  </div>
                  <div className="bg-gray-600/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-white">{totalSpentFormatted}</div>
                    <div className="text-xs text-gray-400">Invested</div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className={`flex items-center space-x-3 p-3 rounded-lg text-white transition-colors ${action.color}`}
                  >
                    {action.icon}
                    <span className="font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Items */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Navigation</h3>
              <div className="space-y-2">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.id)}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                      activeTab === item.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <div className="text-left">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs opacity-75">{item.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Options */}
            <div className="border-t border-gray-700 pt-4">
              <div className="space-y-2">
                <button className="w-full flex items-center space-x-3 p-3 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                  <Search className="w-5 h-5" />
                  <span>Search Domains (SNS)</span>
                </button>
                
                <button className="w-full flex items-center space-x-3 p-3 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                  <Zap className="w-5 h-5" />
                  <span>Cross-Chain Bridge</span>
                </button>
                
                <button className="w-full flex items-center space-x-3 p-3 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                  <Heart className="w-5 h-5" />
                  <span>Support Causes</span>
                </button>
                
                <button className="w-full flex items-center space-x-3 p-3 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </button>
                
                <button className="w-full flex items-center space-x-3 p-3 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                  <HelpCircle className="w-5 h-5" />
                  <span>Help & Support</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-700 text-center">
              <p className="text-xs text-gray-400 mb-2">
                Syndicate v1.0 - Cross-Chain Lottery Platform
              </p>
              <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
                <a href="#" className="hover:text-gray-300 transition-colors flex items-center space-x-1">
                  <ExternalLink className="w-3 h-3" />
                  <span>Terms</span>
                </a>
                <a href="#" className="hover:text-gray-300 transition-colors flex items-center space-x-1">
                  <ExternalLink className="w-3 h-3" />
                  <span>Privacy</span>
                </a>
                <a href="#" className="hover:text-gray-300 transition-colors flex items-center space-x-1">
                  <ExternalLink className="w-3 h-3" />
                  <span>Docs</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}