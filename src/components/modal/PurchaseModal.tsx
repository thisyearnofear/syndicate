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
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { Button } from "@/shared/components/ui/Button";
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';

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
  const { isConnected } = useWalletConnection();
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
  const [step, setStep] = useState<'select' | 'confirm' | 'processing' | 'success'>('select');

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTicketCount(1);
      setStep('select');
      clearError();
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, clearError]);

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
      const result = await purchaseTickets(ticketCount);

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
          <h2 className="font-bold text-2xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
            {step === 'success' ? '🎉 Success!' : '🎫 Buy Tickets'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0 rounded-full"
          >
            ✕
          </Button>
        </CompactFlex>

        {/* Wallet Status */}
        {!isConnected && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={20} />
              <span>Please connect your wallet to purchase tickets</span>
            </div>
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
        {step === 'select' && (
          <CompactStack spacing="lg">
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
                <span className="inline-flex items-center font-semibold rounded-full shadow-lg backdrop-blur-sm transform hover:scale-105 transition-transform duration-200 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 text-xs">
                  🌊 Supports Ocean Cleanup
                </span>
              </CompactFlex>
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

            {/* Purchase button */}
            <Button
              variant="default"
              size="lg"
              className="w-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white shadow-2xl hover:shadow-yellow-500/30 border border-yellow-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handlePurchase}
              disabled={!isConnected || isPurchasing || isInitializing || !!hasInsufficientBalance}
            >
              {!isConnected ? (
                'Connect Wallet'
              ) : isInitializing ? (
                <>⏳ Initializing...</>
              ) : isPurchasing ? (
                <>⚡ Processing...</>
              ) : hasInsufficientBalance ? (
                'Insufficient Balance'
              ) : (
                `⚡ Purchase ${ticketCount} Ticket${ticketCount > 1 ? 's' : ''} - $${totalCost}`
              )}
            </Button>

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
            <div className="text-6xl animate-bounce">🎉</div>
            <h2 className="font-bold text-xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white text-center">
              Purchase Successful!
            </h2>
            <div className="glass p-4 rounded-xl text-center">
              <p className="font-semibold mb-2 text-gray-300 leading-relaxed">
                {purchasedTicketCount} Ticket{purchasedTicketCount > 1 ? 's' : ''} Purchased
              </p>
              <p className="text-sm text-gray-400">
                Good luck in the draw! 🍀
              </p>
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