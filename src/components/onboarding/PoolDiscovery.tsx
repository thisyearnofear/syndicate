"use client";

import React, { useState, useEffect } from 'react';
// Simple CSS-based animations
const motion = {
  div: ({ children, className, initial, animate, exit, transition, ...props }: any) => (
    <div className={`${className} animate-fade-in`} {...props}>
      {children}
    </div>
  ),
  button: ({ children, className, whileHover, whileTap, ...props }: any) => (
    <button className={`${className} transition-transform hover:scale-105 active:scale-95`} {...props}>
      {children}
    </button>
  )
};

const AnimatePresence = ({ children, mode }: any) => (
  <div className="animate-presence">
    {children}
  </div>
);
import { 
  Users, 
  Heart, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Target,
  ArrowRight,
  Star,
  Globe,
  Zap,
  Trophy,
  ChevronRight
} from 'lucide-react';

interface PoolDiscoveryProps {
  userProfile?: any;
  onComplete: () => void;
  className?: string;
}

const FEATURED_POOLS = [
  {
    id: 'ocean-cleanup',
    name: 'Ocean Heroes',
    cause: 'Ocean Cleanup',
    causeIcon: '🌊',
    members: 47,
    maxMembers: 100,
    ticketPrice: 1,
    currentPrize: 2840,
    timeLeft: '2d 14h',
    description: 'Pool together to clean our oceans and win big!',
    impact: '500kg plastic removed',
    trending: true,
    featured: true
  },
  {
    id: 'food-security',
    name: 'Feed the Future',
    cause: 'Food Security',
    causeIcon: '🍽️',
    members: 32,
    maxMembers: 75,
    ticketPrice: 1,
    currentPrize: 1920,
    timeLeft: '1d 8h',
    description: 'Win while providing meals to those in need',
    impact: '1,200 meals provided',
    trending: false,
    featured: true
  },
  {
    id: 'education',
    name: 'Learn & Earn',
    cause: 'Education Access',
    causeIcon: '📚',
    members: 28,
    maxMembers: 60,
    ticketPrice: 1,
    currentPrize: 1680,
    timeLeft: '3d 2h',
    description: 'Support education while chasing jackpots',
    impact: '50 scholarships funded',
    trending: false,
    featured: false
  },
  {
    id: 'climate',
    name: 'Green Warriors',
    cause: 'Climate Action',
    causeIcon: '🌱',
    members: 41,
    maxMembers: 80,
    ticketPrice: 1,
    currentPrize: 2460,
    timeLeft: '4d 16h',
    description: 'Fight climate change and win together',
    impact: '100 trees planted',
    trending: true,
    featured: false
  }
];

const POOL_CATEGORIES = [
  { id: 'trending', name: 'Trending', icon: TrendingUp, color: 'text-orange-400' },
  { id: 'featured', name: 'Featured', icon: Star, color: 'text-yellow-400' },
  { id: 'ending-soon', name: 'Ending Soon', icon: Clock, color: 'text-red-400' },
  { id: 'new', name: 'New Pools', icon: Zap, color: 'text-green-400' }
];

export default function PoolDiscovery({ userProfile, onComplete, className = '' }: PoolDiscoveryProps) {
  const [selectedCategory, setSelectedCategory] = useState('featured');
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [step, setStep] = useState<'browse' | 'pool-detail' | 'joining' | 'success'>('browse');

  const filteredPools = FEATURED_POOLS.filter(pool => {
    switch (selectedCategory) {
      case 'trending':
        return pool.trending;
      case 'featured':
        return pool.featured;
      case 'ending-soon':
        return parseInt(pool.timeLeft.split('d')[0]) <= 1;
      case 'new':
        return pool.members < 20;
      default:
        return true;
    }
  });

  const handleJoinPool = async (poolId: string) => {
    setSelectedPool(poolId);
    setStep('joining');
    
    // Simulate joining process
    setTimeout(() => {
      setStep('success');
      setTimeout(() => {
        onComplete();
      }, 2000);
    }, 2000);
  };

  const selectedPoolData = FEATURED_POOLS.find(p => p.id === selectedPool);

  return (
    <div className={`pool-discovery ${className}`}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {step === 'browse' && (
            <motion.div
              key="browse"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Header */}
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl mb-4"
                >
                  🎯
                </motion.div>
                
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  Discover Lottery Pools
                </h1>
                
                <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                  Join pools that match your values and increase your chances of winning
                </p>

                {userProfile?.snsDomain && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="inline-flex items-center gap-2 bg-purple-900/30 border border-purple-600 rounded-full px-4 py-2"
                  >
                    <Globe className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-400 font-medium">
                      Welcome, {userProfile.snsDomain}!
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Categories */}
              <div className="flex justify-center">
                <div className="bg-gray-800/50 rounded-xl p-1 border border-gray-700">
                  {POOL_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                        selectedCategory === category.id
                          ? 'bg-gray-700 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <category.icon className={`w-4 h-4 ${category.color}`} />
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pool Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPools.map((pool, index) => (
                  <motion.div
                    key={pool.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-all duration-200 group cursor-pointer"
                    onClick={() => setStep('pool-detail')}
                  >
                    {/* Pool Header */}
                    <div className="p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{pool.causeIcon}</div>
                          <div>
                            <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                              {pool.name}
                            </h3>
                            <p className="text-sm text-gray-400">{pool.cause}</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-1">
                          {pool.trending && (
                            <div className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full text-xs font-medium">
                              Trending
                            </div>
                          )}
                          {pool.featured && (
                            <div className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-xs font-medium">
                              Featured
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-gray-300 text-sm">{pool.description}</p>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Users className="w-4 h-4" />
                            Members
                          </div>
                          <div className="text-white font-semibold">
                            {pool.members}/{pool.maxMembers}
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(pool.members / pool.maxMembers) * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Trophy className="w-4 h-4" />
                            Current Prize
                          </div>
                          <div className="text-white font-semibold">
                            ${pool.currentPrize.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Impact & Time */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                          <Heart className="w-4 h-4" />
                          {pool.impact}
                        </div>
                        
                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                          <Clock className="w-4 h-4" />
                          {pool.timeLeft}
                        </div>
                      </div>

                      {/* Join Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinPool(pool.id);
                        }}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group"
                      >
                        Join Pool (${pool.ticketPrice})
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Create Pool CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-center space-y-4"
              >
                <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-xl p-6 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Don't see a pool you like?
                  </h3>
                  <p className="text-gray-300 mb-4">
                    Create your own lottery pool and invite friends to join your cause
                  </p>
                  <button className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                    Create New Pool
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {step === 'joining' && selectedPoolData && (
            <motion.div
              key="joining"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-6 max-w-md mx-auto"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full mx-auto"
              />
              
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">Joining Pool</h2>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{selectedPoolData.causeIcon}</span>
                    <div className="text-left">
                      <h3 className="font-semibold text-white">{selectedPoolData.name}</h3>
                      <p className="text-sm text-gray-400">{selectedPoolData.cause}</p>
                    </div>
                  </div>
                </div>
                <p className="text-gray-300">
                  Please confirm the transaction in your wallet...
                </p>
              </div>
            </motion.div>
          )}

          {step === 'success' && selectedPoolData && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-6 max-w-md mx-auto"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="text-5xl"
              >
                🎉
              </motion.div>
              
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">Welcome to the Pool!</h2>
                <div className="bg-gradient-to-r from-green-900/50 to-blue-900/50 rounded-lg p-4 border border-green-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{selectedPoolData.causeIcon}</span>
                    <div className="text-left">
                      <h3 className="font-semibold text-white">{selectedPoolData.name}</h3>
                      <p className="text-sm text-gray-400">You're now member #{selectedPoolData.members + 1}</p>
                    </div>
                  </div>
                </div>
                <p className="text-gray-300">
                  You're all set! Let's explore your dashboard.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}