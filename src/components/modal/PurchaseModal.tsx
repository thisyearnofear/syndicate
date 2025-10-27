"use client";

/**
 * ENHANCED PURCHASE MODAL
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhanced with premium UI components
 * - MODULAR: Uses premium design system
 * - CLEAN: Clear purchase flow
 * - PERFORMANT: Optimized animations
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';
import { useWalletConnection, WalletType } from '@/hooks/useWalletConnection';
import { Button } from "@/shared/components/ui/Button";
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import type { SyndicateInfo } from '@/domains/lottery/types';

export interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticketCount: number) => void;
}

const CountUpText = ({ value, duration = 2000, prefix = '', suffix = '', className = '' }: { value: number; duration?: number; prefix?: string; suffix?: string; className?: string; }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  return (
    <span className={`font-mono font-bold ${className}`}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

export default function PurchaseModal({ isOpen, onClose, onSuccess }: PurchaseModalProps) {
  const { isConnected, connect } = useWalletConnection();
  const {
    // State
    isInitializing,
    isPurchasing,
    isApproving,
    isCheckingBalance,
    userBalance,
    ticketPrice,
    currentJackpot,
    lastTxHash,
    error,
    purchaseSuccess,
    purchasedTicketCount,
    // Actions
    purchaseTickets,
    refreshBalance,
    clearError,
    reset
  } = useTicketPurchase();

  const [ticketCount, setTicketCount] = useState(1);
  const [step, setStep] = useState<'mode' | 'select' | 'confirm' | 'processing' | 'success'>('mode');
  const [purchaseMode, setPurchaseMode] = useState<'individual' | 'syndicate'>('individual');
  const [selectedSyndicate, setSelectedSyndicate] = useState<SyndicateInfo | null>(null);
  const [syndicates, setSyndicates] = useState<SyndicateInfo[]>([]);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTicketCount(1);
      setStep('mode');
      setPurchaseMode('individual');
      setSelectedSyndicate(null);
      clearError();
      
      // Fetch syndicates data
      fetchSyndicates();
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, clearError]);

  // Fetch syndicates data
  const fetchSyndicates = async () => {
    try {
      const response = await fetch('/api/syndicates');
      if (response.ok) {
        const data = await response.json();
        setSyndicates(data);
      }
    } catch (error) {
      console.error('Failed to fetch syndicates:', error);
    }
  };

  // Handle purchase success
  useEffect(() => {
    if (purchaseSuccess) {
      setStep('success');
      onSuccess?.(purchasedTicketCount);
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
        reset();
      }, 5000);
    }
  }, [purchaseSuccess, purchasedTicketCount, onSuccess, onClose, reset]);

  const handlePurchase = async () => {
    if (!isConnected) {
      return;
    }

    setStep('processing');
    
    try {
      // Use the enhanced purchaseTickets function with syndicate support
      const result = await purchaseTickets(
        ticketCount, 
        purchaseMode === 'syndicate' ? selectedSyndicate?.id : undefined
      );

      if (result.success) {
        setStep('success');
      } else {
        setStep('select');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      setStep('select');
    }
  };

  const quickAmounts = [1, 5, 10, 25];
  const totalCost = (parseFloat(ticketPrice) * ticketCount).toFixed(2);
  const hasInsufficientBalance = userBalance && parseFloat(userBalance.usdc) < parseFloat(totalCost);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Premium backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Premium modal */}
      <div className="relative glass-premium rounded-3xl p-8 w-full max-w-lg border border-white/20 animate-scale-in">
        {/* Header */}
        <CompactFlex align="center" justify="between" className="mb-6">
          <div className="flex-1">
            <h2 className="font-bold text-2xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
              {step === 'success' ? '🎉 Success!' : 
               step === 'mode' ? '🎫 Buy Tickets' :
               selectedSyndicate ? `🌊 ${selectedSyndicate.name}` : '🎫 Buy Tickets'}
            </h2>
            {selectedSyndicate && step !== 'mode' && (
              <p className="text-sm text-gray-400 mt-1">
                Supporting {selectedSyndicate.cause} • {selectedSyndicate.membersCount.toLocaleString()} members
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0 rounded-full"
          >
            ✕
          </Button>
        </CompactFlex>

        {/* Wallet Connection */}
        {!isConnected && (
          <div className="mb-6">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <AlertCircle size={20} />
                <span>Connect your wallet to purchase tickets</span>
              </div>
            </div>
            <ConnectWallet onConnect={connect} />
          </div>
        )}

        {/* Balance Display */}
        {isConnected && userBalance && (
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-white/70">Your USDC Balance:</span>
              <span className="text-white font-semibold">${userBalance.usdc}</span>
            </div>
            {isCheckingBalance && (
              <div className="flex items-center gap-2 mt-2 text-white/60">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Updating balance...</span>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-red-300 hover:text-red-200 text-sm mt-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content based on step */}
        {step === 'mode' && (
          <CompactStack spacing="lg">
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-white mb-2">Choose Purchase Mode</h3>
              <p className="text-gray-400">How would you like to buy tickets?</p>
            </div>

            {/* Purchase Mode Options */}
            <CompactStack spacing="md">
              {/* Individual Mode */}
              <div
                onClick={() => {
                  setPurchaseMode('individual');
                  setSelectedSyndicate(null);
                  setStep('select');
                }}
                className={`glass p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-105 ${
                  purchaseMode === 'individual' 
                    ? 'ring-2 ring-blue-500 bg-blue-500/10' 
                    : 'hover:bg-white/5'
                }`}
              >
                <CompactFlex align="center" gap="md">
                  <div className="text-3xl">🎫</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white mb-1">Buy for Myself</h4>
                    <p className="text-sm text-gray-400">Keep 100% of winnings</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                        ✓ Full Control
                      </span>
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                        ⚡ Instant
                      </span>
                    </div>
                  </div>
                </CompactFlex>
              </div>

              {/* Syndicate Mode */}
              <div
                onClick={() => setPurchaseMode('syndicate')}
                className={`glass p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-105 ${
                  purchaseMode === 'syndicate' 
                    ? 'ring-2 ring-purple-500 bg-purple-500/10' 
                    : 'hover:bg-white/5'
                }`}
              >
                <CompactFlex align="center" gap="md">
                  <div className="text-3xl">🌊</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white mb-1">Join Pool & Support Cause</h4>
                    <p className="text-sm text-gray-400">Pool tickets with others, support causes</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                        🤝 Community
                      </span>
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                        🌍 Impact
                      </span>
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                        🔥 Popular
                      </span>
                    </div>
                  </div>
                </CompactFlex>
              </div>
            </CompactStack>

            {/* Syndicate Selection */}
            {purchaseMode === 'syndicate' && (
              <CompactStack spacing="md">
                <div className="text-center">
                  <h4 className="font-semibold text-white mb-2">Choose a Pool</h4>
                  <p className="text-sm text-gray-400">Select which cause you'd like to support</p>
                </div>
                
                <CompactStack spacing="sm">
                  {syndicates.map((syndicate) => (
                    <div
                      key={syndicate.id}
                      onClick={() => {
                        setSelectedSyndicate(syndicate);
                        setStep('select');
                      }}
                      className={`glass p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-105 ${
                        selectedSyndicate?.id === syndicate.id 
                          ? 'ring-2 ring-green-500 bg-green-500/10' 
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <CompactFlex align="center" gap="md">
                        <div className="text-2xl">
                          {syndicate.cause === 'Ocean Cleanup' ? '🌊' :
                           syndicate.cause === 'Education Access' ? '📚' :
                           syndicate.cause === 'Climate Action' ? '🌍' :
                           syndicate.cause === 'Food Security' ? '🌾' : '✨'}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold text-white">{syndicate.name}</h5>
                          <p className="text-xs text-gray-400">{syndicate.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-blue-400">
                              👥 {syndicate.membersCount.toLocaleString()} members
                            </span>
                            <span className="text-green-400">
                              🎯 {syndicate.cause}
                            </span>
                          </div>
                        </div>
                      </CompactFlex>
                    </div>
                  ))}
                </CompactStack>
              </CompactStack>
            )}

            {/* Continue Button for Syndicate Mode */}
            {purchaseMode === 'syndicate' && selectedSyndicate && (
              <Button
                variant="default"
                size="lg"
                onClick={() => setStep('select')}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl"
              >
                Continue with {selectedSyndicate.name}
              </Button>
            )}
          </CompactStack>
        )}

        {step === 'select' && (
          <CompactStack spacing="lg">
            {/* Back to Mode Selection */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('mode')}
                className="text-gray-400 hover:text-white"
              >
                ← Back to Options
              </Button>
              {selectedSyndicate && (
                <div className="text-xs text-gray-400">
                  Pool Mode
                </div>
              )}
            </div>

            {/* Current Jackpot */}
            <div className="text-center mb-4">
              <p className="text-white/70">
                Current Jackpot: <span className="text-yellow-400 font-bold">${currentJackpot} USDC</span>
              </p>
              {ticketPrice && (
                <p className="text-white/60 text-sm mt-1">
                  Ticket Price: ${ticketPrice} USDC
                </p>
              )}
            </div>

            {/* Quick amount selection */}
            <div>
              <p className="mb-3 text-sm font-medium">
                Quick Select
              </p>
              <CompactFlex gap="sm" className="flex-wrap">
                {quickAmounts.map((amount) => (
                  <Button
                    key={amount}
                    variant={ticketCount === amount ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setTicketCount(amount)}
                    className={ticketCount === amount ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl border border-blue-500/20" : ""}
                  >
                    {amount} ticket{amount > 1 ? 's' : ''}
                  </Button>
                ))}
              </CompactFlex>
            </div>

            {/* Custom amount */}
            <div>
              <p className="mb-3 text-sm font-medium">
                Custom Amount
              </p>
              <CompactFlex align="center" gap="md" justify="center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                  className="w-12 h-12 p-0 rounded-full"
                  disabled={ticketCount <= 1}
                >
                  -
                </Button>
                
                <div className="text-center min-w-[80px]">
                  <div className="text-3xl font-black gradient-text-primary">
                    {ticketCount}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    ticket{ticketCount > 1 ? 's' : ''}
                  </p>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTicketCount(ticketCount + 1)}
                  className="w-12 h-12 p-0 rounded-full"
                >
                  +
                </Button>
              </CompactFlex>
            </div>

            {/* Price display */}
            <div className="glass p-6 rounded-2xl">
              <CompactFlex align="center" justify="between" className="mb-2">
                <p className="font-medium text-gray-300 leading-relaxed">Total Cost:</p>
                <div className="text-3xl font-black text-green-400">
                  ${totalCost} USDC
                </div>
              </CompactFlex>
              
              <CompactFlex align="center" justify="between" gap="sm" className="text-sm">
                <p className="text-sm text-gray-400 leading-relaxed">
                  {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
                </p>
                {selectedSyndicate ? (
                  <span className="inline-flex items-center font-semibold rounded-full shadow-lg backdrop-blur-sm transform hover:scale-105 transition-transform duration-200 bg-gradient-to-r from-purple-500 to-blue-600 text-white px-2 py-1 text-xs">
                    {selectedSyndicate.cause === 'Ocean Cleanup' ? '🌊' :
                     selectedSyndicate.cause === 'Education Access' ? '📚' :
                     selectedSyndicate.cause === 'Climate Action' ? '🌍' :
                     selectedSyndicate.cause === 'Food Security' ? '🌾' : '✨'} {selectedSyndicate.cause}
                  </span>
                ) : (
                  <span className="inline-flex items-center font-semibold rounded-full shadow-lg backdrop-blur-sm transform hover:scale-105 transition-transform duration-200 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 text-xs">
                    🎫 Individual Purchase
                  </span>
                )}
              </CompactFlex>

              {/* Syndicate Impact Preview */}
              {selectedSyndicate && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Pool Impact:</span>
                    <span className="text-purple-400 font-semibold">
                      Joining {selectedSyndicate.membersCount.toLocaleString()} members
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-gray-400">Cause Support:</span>
                    <span className="text-green-400 font-semibold">
                      20% of winnings → {selectedSyndicate.cause}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Insufficient Balance Warning */}
            {hasInsufficientBalance && (
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-400">
                  <AlertCircle size={20} />
                  <span>Insufficient USDC balance</span>
                </div>
                <button
                  onClick={refreshBalance}
                  className="text-yellow-300 hover:text-yellow-200 text-sm mt-2 underline"
                >
                  Refresh Balance
                </button>
              </div>
            )}

            {/* Purchase button - only show when connected */}
            {isConnected && (
              <Button
                variant="default"
                size="lg"
                className="w-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white shadow-2xl hover:shadow-yellow-500/30 border border-yellow-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handlePurchase}
                disabled={isPurchasing || isInitializing || !!hasInsufficientBalance}
              >
                {isInitializing ? (
                  <>⏳ Initializing...</>
                ) : isPurchasing ? (
                  <>⚡ Processing...</>
                ) : hasInsufficientBalance ? (
                  'Insufficient Balance'
                ) : selectedSyndicate ? (
                  `🌊 Join ${selectedSyndicate.name} - $${totalCost}`
                ) : (
                  `⚡ Purchase ${ticketCount} Ticket${ticketCount > 1 ? 's' : ''} - $${totalCost}`
                )}
              </Button>
            )}

            {/* Terms */}
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              By purchasing, you agree to our terms and support ocean cleanup initiatives
            </p>
          </CompactStack>
        )}

        {step === 'processing' && (
          <CompactStack spacing="lg" align="center">
            <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <h2 className="font-bold text-xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">Processing Purchase...</h2>
            <p className="text-gray-400 text-center leading-relaxed">
              {isApproving ? 'Approving USDC spending...' : 'Purchasing your tickets...'}
            </p>
            <p className="text-sm text-white/50 text-center">
              Please confirm the transaction in your wallet
            </p>
          </CompactStack>
        )}

        {step === 'success' && (
          <CompactStack spacing="lg" align="center">
            <div className="text-6xl animate-bounce">
              {purchaseMode === 'syndicate' ? '🌊' : '🎉'}
            </div>
            <h2 className="font-bold text-xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white text-center">
              {purchaseMode === 'syndicate' ? 'Pool Joined!' : 'Purchase Successful!'}
            </h2>
            <div className="glass p-4 rounded-xl text-center">
              <p className="font-semibold mb-2 text-gray-300 leading-relaxed">
                {purchasedTicketCount} Ticket{purchasedTicketCount > 1 ? 's' : ''} Purchased
              </p>
              {purchaseMode === 'syndicate' && selectedSyndicate ? (
                <div className="mt-2">
                  <p className="text-sm text-blue-400">
                    Supporting {selectedSyndicate.cause}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    You're member #{selectedSyndicate.membersCount + 1}!
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Good luck in the draw! 🍀
                </p>
              )}
            </div>
            
            {lastTxHash && (
              <div className="bg-white/5 rounded-lg p-4 w-full">
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-sm">Transaction:</span>
                  <a
                    href={`https://basescan.org/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    View on Basescan
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            )}
            
            <p className="text-sm text-gray-400 text-center">
              This modal will close automatically...
            </p>
          </CompactStack>
        )}
      </div>
    </div>
  );
}