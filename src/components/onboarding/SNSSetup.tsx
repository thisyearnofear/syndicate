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
import { useSNS } from '@/hooks/useSNS';
import { 
  Search, 
  CheckCircle, 
  X, 
  ArrowRight, 
  Sparkles, 
  User,
  Globe,
  Shield,
  Zap
} from 'lucide-react';

interface SNSSetupProps {
  userProfile?: any;
  onComplete: (snsData?: any) => void;
  onSkip: () => void;
  className?: string;
}

const SUGGESTED_DOMAINS = [
  'lottery.sol',
  'winner.sol',
  'lucky.sol',
  'syndicate.sol',
  'pool.sol',
  'cause.sol'
];

const SNS_BENEFITS = [
  {
    icon: User,
    title: 'Your Identity',
    description: 'Use your .sol name instead of long wallet addresses'
  },
  {
    icon: Globe,
    title: 'Cross-Platform',
    description: 'Works across all Solana apps and services'
  },
  {
    icon: Shield,
    title: 'Secure',
    description: 'Decentralized naming that you truly own'
  },
  {
    icon: Zap,
    title: 'Social Features',
    description: 'Easy to share and remember for friends'
  }
];

export default function SNSSetup({ userProfile, onComplete, onSkip, className = '' }: SNSSetupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [step, setStep] = useState<'intro' | 'search' | 'confirm' | 'registering' | 'success'>('intro');
  
  // Mock SNS functionality for demo
  const [isSearching, setIsSearching] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  
  const searchDomain = async (domain: string) => {
    setIsSearching(true);
    // Simulate API call
    setTimeout(() => {
      setSearchResult({ available: Math.random() > 0.5, domain });
      setIsSearching(false);
    }, 1000);
  };
  
  const registerDomain = async (domain: string) => {
    setIsRegistering(true);
    // Simulate registration
    setTimeout(() => {
      setIsRegistering(false);
    }, 2000);
  };

  // Auto-suggest based on user profile
  useEffect(() => {
    if (userProfile?.name && !searchTerm) {
      const cleanName = userProfile.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      setSearchTerm(cleanName);
    }
  }, [userProfile, searchTerm]);

  const handleSearch = async (domain: string) => {
    setSearchTerm(domain);
    await searchDomain(domain);
  };

  const handleRegister = async () => {
    if (!selectedDomain) return;
    
    setStep('registering');
    try {
      await registerDomain(selectedDomain);
      setStep('success');
      
      setTimeout(() => {
        onComplete({ 
          snsDomain: selectedDomain,
          snsRegistered: true 
        });
      }, 2000);
    } catch (error) {
      console.error('SNS registration failed:', error);
      setStep('search');
    }
  };

  return (
    <div className={`sns-setup ${className}`}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8"
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-5xl mb-4"
                >
                  ✨
                </motion.div>
                
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  Get Your .sol Name
                </h1>
                
                <p className="text-xl text-gray-300 max-w-lg mx-auto">
                  Claim your unique Solana domain for easy identification in lottery pools
                </p>
              </div>

              {/* Benefits Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {SNS_BENEFITS.map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <benefit.icon className="w-6 h-6 text-purple-400 mb-2" />
                    <h3 className="font-semibold text-white mb-1">{benefit.title}</h3>
                    <p className="text-sm text-gray-400">{benefit.description}</p>
                  </motion.div>
                ))}
              </div>

              {/* Example */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-6 border border-purple-500/20"
              >
                <div className="text-center space-y-3">
                  <p className="text-gray-300">Instead of:</p>
                  <code className="block text-xs text-gray-500 bg-black/20 rounded p-2 break-all">
                    7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
                  </code>
                  <p className="text-gray-300">You'll have:</p>
                  <code className="block text-lg text-purple-400 font-semibold">
                    {userProfile?.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'yourname'}.sol
                  </code>
                </div>
              </motion.div>

              <div className="flex gap-4 justify-center">
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  onClick={() => setStep('search')}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Claim Your .sol Name
                </motion.button>
                
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  onClick={onSkip}
                  className="border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-medium py-3 px-6 rounded-xl transition-all duration-200"
                >
                  Skip for Now
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-white">Find Your Perfect Domain</h2>
                <p className="text-gray-300">
                  Search for available .sol domains or pick from our suggestions
                </p>
              </div>

              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  placeholder="Enter your desired name"
                  className="block w-full pl-10 pr-20 py-4 border border-gray-600 rounded-xl bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <span className="text-gray-400 font-medium">.sol</span>
                </div>
              </div>

              {/* Search Button */}
              <button
                onClick={() => handleSearch(searchTerm)}
                disabled={!searchTerm || isSearching}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Checking availability...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Check Availability
                  </>
                )}
              </button>

              {/* Search Result */}
              {searchResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border ${
                    searchResult.available
                      ? 'bg-green-900/30 border-green-600'
                      : 'bg-red-900/30 border-red-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {searchResult.available ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <X className="w-5 h-5 text-red-400" />
                    )}
                    <div className="flex-1">
                      <p className={`font-semibold ${
                        searchResult.available ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {searchTerm}.sol is {searchResult.available ? 'available!' : 'taken'}
                      </p>
                      {searchResult.available && (
                        <p className="text-sm text-gray-400">
                          Registration fee: ~0.02 SOL
                        </p>
                      )}
                    </div>
                    {searchResult.available && (
                      <button
                        onClick={() => {
                          setSelectedDomain(searchTerm);
                          setStep('confirm');
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Select
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Suggestions */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Popular Suggestions</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {SUGGESTED_DOMAINS.map((domain) => (
                    <button
                      key={domain}
                      onClick={() => handleSearch(domain.replace('.sol', ''))}
                      className="bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 text-white py-2 px-3 rounded-lg transition-all duration-200 text-sm"
                    >
                      {domain}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={onSkip}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Skip this step →
                </button>
              </div>
            </motion.div>
          )}

          {step === 'confirm' && selectedDomain && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-6"
            >
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">Confirm Your Domain</h2>
                <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-6 border border-purple-500/20">
                  <p className="text-2xl font-bold text-purple-400 mb-2">
                    {selectedDomain}.sol
                  </p>
                  <p className="text-gray-300">
                    This will be your unique identity across Solana
                  </p>
                </div>
              </div>

              <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
                <p className="text-yellow-200 text-sm">
                  <strong>Note:</strong> Domain registration requires a small SOL fee (~0.02 SOL) 
                  and cannot be undone. Make sure you're happy with your choice!
                </p>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleRegister}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Register Domain
                </button>
                
                <button
                  onClick={() => setStep('search')}
                  className="border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-medium py-3 px-6 rounded-xl transition-all duration-200"
                >
                  Choose Different
                </button>
              </div>
            </motion.div>
          )}

          {step === 'registering' && (
            <motion.div
              key="registering"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-6"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full mx-auto"
              />
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Registering Your Domain</h2>
                <p className="text-gray-300">
                  Please confirm the transaction in your wallet...
                </p>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-6"
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
                <h2 className="text-2xl font-bold text-white">Domain Registered!</h2>
                <div className="bg-gradient-to-r from-green-900/50 to-blue-900/50 rounded-lg p-4 border border-green-500/20">
                  <p className="text-xl font-bold text-green-400">
                    {selectedDomain}.sol
                  </p>
                  <p className="text-gray-300">is now yours!</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}