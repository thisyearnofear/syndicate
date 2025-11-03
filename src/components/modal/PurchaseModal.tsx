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
import { Loader2, AlertCircle, ExternalLink, Share2, Twitter, MessageCircle } from 'lucide-react';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { Button } from "@/shared/components/ui/Button";
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import { useSuccessToast, useErrorToast } from '@/shared/components/ui/Toast';
import { socialService } from '@/services/socialService';
import type { SyndicateInfo } from '@/domains/lottery/types';

export interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticketCount: number) => void;
}



export default function PurchaseModal({ isOpen, onClose, onSuccess }: PurchaseModalProps) {
  const { isConnected, connect } = useWalletConnection();
  const successToast = useSuccessToast();
  const errorToast = useErrorToast();
  const {
    // State
    isInitializing,
    isPurchasing,
    isApproving,
    isCheckingBalance,
    userBalance,
    ticketPrice,
    currentJackpot,
    oddsInfo,
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
  const [step, setStep] = useState<'mode' | 'select' | 'confirm' | 'processing' | 'success' | 'share'>('mode');
  const [purchaseMode, setPurchaseMode] = useState<'individual' | 'syndicate'>('individual');
  const [selectedSyndicate, setSelectedSyndicate] = useState<SyndicateInfo | null>(null);
  const [syndicates, setSyndicates] = useState<SyndicateInfo[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

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

      // Show success toast
      successToast(
        'Tickets Purchased!',
        `${purchasedTicketCount} ticket${purchasedTicketCount > 1 ? 's' : ''} successfully purchased`,
        {
          label: 'View My Tickets',
          onClick: () => window.location.href = '/my-tickets'
        }
      );

      // Auto-close after success
      setTimeout(() => {
        onClose();
        reset();
      }, 5000);
    }
  }, [purchaseSuccess, purchasedTicketCount, onSuccess, onClose, reset, successToast]);

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
        // Show error toast
        errorToast(
          'Purchase Failed',
          result.error || 'Unable to complete ticket purchase. Please try again.',
          {
            label: 'Retry',
            onClick: () => handlePurchase()
          }
        );
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      setStep('select');
      // Show error toast for unexpected errors
      errorToast(
        'Purchase Error',
        'An unexpected error occurred. Please check your connection and try again.'
      );
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
                className={`glass p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-105 ${purchaseMode === 'individual'
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
                className={`glass p-6 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-105 ${purchaseMode === 'syndicate'
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
                      className={`glass p-4 rounded-xl cursor-pointer transition-all duration-300 hover:scale-105 ${selectedSyndicate?.id === syndicate.id
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
              {oddsInfo && (
                <div className="mt-3 p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-blue-400 font-semibold text-sm">Your Odds</p>
                  <p className="text-white font-bold">{oddsInfo.oddsFormatted(ticketCount)}</p>
                  {ticketCount > 1 && (
                    <p className="text-blue-300 text-xs mt-1">
                      Buy {ticketCount} tickets = {oddsInfo.oddsFormatted(ticketCount)} chance to win!
                    </p>
                  )}
                </div>
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

            {/* ENHANCEMENT: Link to ticket history and sharing */}
            <div className="w-full space-y-3">
            <CompactFlex gap="md" className="w-full">
            <Button
              variant="default"
              size="lg"
            onClick={() => {
              onClose();
              // Navigate to tickets page
                window.location.href = '/my-tickets';
              }}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl"
            >
                🎫 View My Tickets
                </Button>

            <Button
              variant="default"
              size="lg"
              onClick={() => setShowShareModal(true)}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl"
            >
                <Share2 size={18} className="mr-2" />
                  Share Win
                </Button>
              </CompactFlex>

              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="w-full text-gray-400 hover:text-white"
              >
                Continue Playing
              </Button>
            </div>

            <p className="text-xs text-gray-400 text-center">
            Your tickets are now active for the next draw
            </p>
            </CompactStack>
            )}

                {/* Share Modal */}
                  {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setShowShareModal(false)}
            />

            <div className="relative glass-premium rounded-3xl p-8 w-full max-w-md border border-white/20 animate-scale-in">
              <CompactFlex align="center" justify="between" className="mb-6">
                <h2 className="font-bold text-2xl text-white">Share Your Purchase</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowShareModal(false)}
                  className="w-8 h-8 p-0 rounded-full"
                >
                  ✕
                </Button>
              </CompactFlex>

              <CompactStack spacing="lg">
                <p className="text-gray-300 text-center">
                  Share your lottery ticket purchase and help spread the word! 🎉
                </p>

                <div className="space-y-3">
                  <Button
                  variant="default"
                  size="lg"
                  onClick={() => {
                  const shareData = {
                    ticketCount: purchasedTicketCount,
                    jackpotAmount: currentJackpot,
                    odds: oddsInfo ? oddsInfo.oddsFormatted(purchasedTicketCount) : 'great',
                      platformUrl: window.location.origin,
                    };
                      const content = socialService.createLotteryShareContent(shareData);
                    const url = socialService.generateTwitterUrl(content.twitterText);
                    window.open(url, '_blank');
                      setShowShareModal(false);
                    }}
                    className="w-full bg-[#1DA1F2] hover:bg-[#1a91da] text-white"
                  >
                  <Twitter size={20} className="mr-2" />
                  Share on Twitter
                  </Button>

                  <Button
                  variant="default"
                  size="lg"
                  onClick={() => {
                      const shareData = {
                      ticketCount: purchasedTicketCount,
                      jackpotAmount: currentJackpot,
                        odds: oddsInfo ? oddsInfo.oddsFormatted(purchasedTicketCount) : 'great',
                        platformUrl: window.location.origin,
                      };
                      const content = socialService.createLotteryShareContent(shareData);
                      socialService.shareToFarcaster(content.neynarCast).then(() => {
                        setShowShareModal(false);
                      });
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  >
                    <MessageCircle size={20} className="mr-2" />
                    Share on Farcaster
                  </Button>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  Help others discover Megapot and join the fun! 🌊
                </p>
              </CompactStack>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}