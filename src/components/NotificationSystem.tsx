"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useSolanaWallet } from '@/providers/SolanaWalletProvider';
import { useCrossChain } from '@/providers/CrossChainProvider';
import { useUserStatsDisplay } from '@/providers/MegapotProvider';
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Trophy, 
  Ticket, 
  Zap, 
  Heart,
  Gift,
  TrendingUp,
  Users
} from 'lucide-react';

type NotificationType = 'success' | 'info' | 'warning' | 'achievement' | 'lottery' | 'crosschain';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionText?: string;
  icon?: React.ReactNode;
}

interface NotificationSystemProps {
  className?: string;
}

export default function NotificationSystem({ className = '' }: NotificationSystemProps) {
  const { address } = useAccount();
  const { connected: isSolanaConnected } = useSolanaWallet();
  const { activeTransactions } = useCrossChain();
  const { totalTickets, recentPurchases } = useUserStatsDisplay();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Generate notification based on type
  const createNotification = useCallback((type: NotificationType, title: string, message: string, actionUrl?: string, actionText?: string): Notification => {
    const icons = {
      success: <CheckCircle className="w-5 h-5 text-green-400" />,
      info: <Info className="w-5 h-5 text-blue-400" />,
      warning: <AlertCircle className="w-5 h-5 text-yellow-400" />,
      achievement: <Trophy className="w-5 h-5 text-purple-400" />,
      lottery: <Ticket className="w-5 h-5 text-blue-400" />,
      crosschain: <Zap className="w-5 h-5 text-purple-400" />
    };

    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      actionUrl,
      actionText,
      icon: icons[type]
    };
  }, []);

  // Add notification to the list
  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 19)]); // Keep max 20 notifications
    setUnreadCount(prev => prev + 1);
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    setUnreadCount(0);
  }, []);

  // Remove notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id);
      if (notification && !notification.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(notif => notif.id !== id);
    });
  }, []);

  // Listen for wallet connection events
  useEffect(() => {
    if (address && !notifications.some(n => n.title.includes('EVM Wallet Connected'))) {
      addNotification(createNotification(
        'success',
        'EVM Wallet Connected! 🎉',
        'Your Ethereum wallet is now connected. You can start purchasing lottery tickets and participating in cross-chain activities.',
        '#lottery',
        'Buy Tickets'
      ));
    }
  }, [address, addNotification, createNotification, notifications]);

  useEffect(() => {
    if (isSolanaConnected && !notifications.some(n => n.title.includes('Solana Wallet Connected'))) {
      addNotification(createNotification(
        'achievement',
        'Solana Wallet Connected! ⚡',
        'Awesome! You\'ve unlocked Solana features including SNS domain resolution and enhanced cross-chain capabilities.',
        '#sns',
        'Explore SNS'
      ));
    }
  }, [isSolanaConnected, addNotification, createNotification, notifications]);

  // Listen for ticket purchases
  useEffect(() => {
    if (recentPurchases.length > 0) {
      const latestPurchase = recentPurchases[0];
      const existingNotif = notifications.find(n => 
        n.message.includes(`Round #${latestPurchase.jackpotRoundId}`) && 
        n.message.includes(`${latestPurchase.ticketsPurchased} ticket`)
      );
      
      if (!existingNotif) {
        addNotification(createNotification(
          'lottery',
          'Tickets Purchased! 🎫',
          `Successfully purchased ${latestPurchase.ticketsPurchased} ticket${latestPurchase.ticketsPurchased > 1 ? 's' : ''} for Round #${latestPurchase.jackpotRoundId}. Good luck!`,
          '#dashboard',
          'View Dashboard'
        ));
      }
    }
  }, [recentPurchases, addNotification, createNotification, notifications]);

  // Listen for cross-chain transactions
  useEffect(() => {
    activeTransactions.forEach(tx => {
      const existingNotif = notifications.find(n => n.message.includes(tx.id));
      if (!existingNotif) {
        let title = '';
        let message = '';
        
        switch (tx.status) {
          case 'pending':
            title = 'Cross-Chain Transaction Initiated 🌉';
            message = `Transaction ${tx.id.slice(0, 8)}... is being processed from ${tx.sourceChain} to ${tx.targetChain}.`;
            break;
          case 'signed':
            title = 'Transaction Signed ✍️';
            message = `Your cross-chain transaction ${tx.id.slice(0, 8)}... has been signed and is being executed.`;
            break;
          case 'executed':
            title = 'Cross-Chain Success! ✅';
            message = `Transaction ${tx.id.slice(0, 8)}... completed successfully. Your assets are now available on ${tx.targetChain}.`;
            break;
          case 'failed':
            title = 'Transaction Failed ❌';
            message = `Cross-chain transaction ${tx.id.slice(0, 8)}... failed. Please try again or contact support.`;
            break;
        }
        
        if (title && message) {
          addNotification(createNotification(
            'crosschain',
            title,
            message,
            '#bridge',
            'View Bridge'
          ));
        }
      }
    });
  }, [activeTransactions, addNotification, createNotification, notifications]);

  // Achievement notifications based on milestones
  useEffect(() => {
    const milestones = [
      { tickets: 1, title: 'First Ticket! 🎯', message: 'Congratulations on purchasing your first lottery ticket! Your journey begins now.' },
      { tickets: 5, title: 'Getting Started! 🚀', message: 'You\'ve purchased 5 tickets! You\'re getting the hang of this.' },
      { tickets: 10, title: 'Ticket Collector! 🏆', message: 'Amazing! You\'ve collected 10 tickets. You\'re becoming a serious player!' },
      { tickets: 25, title: 'Lottery Enthusiast! 🌟', message: 'Wow! 25 tickets purchased. You\'re really committed to winning big!' },
      { tickets: 50, title: 'High Roller! 💎', message: 'Incredible! 50 tickets and counting. You\'re a true lottery champion!' }
    ];

    milestones.forEach(milestone => {
      if (totalTickets >= milestone.tickets && 
          !notifications.some(n => n.message.includes(`${milestone.tickets} ticket`))) {
        addNotification(createNotification(
          'achievement',
          milestone.title,
          milestone.message,
          '#dashboard',
          'View Stats'
        ));
      }
    });
  }, [totalTickets, addNotification, createNotification, notifications]);

  // Periodic lottery updates (mock)
  useEffect(() => {
    const interval = setInterval(() => {
      const updates = [
        { title: 'Jackpot Growing! 💰', message: 'The current jackpot has increased! Don\'t miss your chance to win big.' },
        { title: 'New Round Starting! 🎲', message: 'A new lottery round is about to begin. Get your tickets now!' },
        { title: 'Community Milestone! 🎉', message: 'The Syndicate community has reached a new participation milestone!' }
      ];
      
      if (Math.random() < 0.3 && notifications.length < 15) { // 30% chance every 30 seconds
        const randomUpdate = updates[Math.floor(Math.random() * updates.length)];
        addNotification(createNotification(
          'info',
          randomUpdate.title,
          randomUpdate.message,
          '#lottery',
          'Join Now'
        ));
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [addNotification, createNotification, notifications.length]);

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getNotificationBgColor = (type: NotificationType) => {
    const colors = {
      success: 'bg-green-900/20 border-green-500/30',
      info: 'bg-blue-900/20 border-blue-500/30',
      warning: 'bg-yellow-900/20 border-yellow-500/30',
      achievement: 'bg-purple-900/20 border-purple-500/30',
      lottery: 'bg-blue-900/20 border-blue-500/30',
      crosschain: 'bg-purple-900/20 border-purple-500/30'
    };
    return colors[type];
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">Notifications</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No notifications yet</p>
                <p className="text-sm mt-1">We'll notify you about important updates</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-700/50 transition-colors ${
                      !notification.read ? 'bg-gray-700/30' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {notification.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h4 className={`text-sm font-medium ${
                            !notification.read ? 'text-white' : 'text-gray-300'
                          }`}>
                            {notification.title}
                          </h4>
                          <button
                            onClick={() => removeNotification(notification.id)}
                            className="text-gray-500 hover:text-gray-300 transition-colors ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className={`text-sm mt-1 ${
                          !notification.read ? 'text-gray-300' : 'text-gray-400'
                        }`}>
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(notification.timestamp)}
                          </span>
                          <div className="flex items-center space-x-2">
                            {notification.actionUrl && notification.actionText && (
                              <button
                                onClick={() => {
                                  markAsRead(notification.id);
                                  // Handle navigation to actionUrl
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                {notification.actionText}
                              </button>
                            )}
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}