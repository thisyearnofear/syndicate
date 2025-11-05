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

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useLottery } from '@/domains/lottery/hooks/useLottery';
import { Button } from "@/shared/components/ui/Button";
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import { useSuccessToast, useErrorToast } from '@/shared/components/ui/Toast';
import { socialService } from '@/services/socialService';
import type { SyndicateInfo } from '@/domains/lottery/types';

import { ModeStep } from './purchase/ModeStep';
import { SelectStep } from './purchase/SelectStep';
import { ProcessingStep } from './purchase/ProcessingStep';
import { SuccessStep } from './purchase/SuccessStep';
import { ShareModal } from './purchase/ShareModal';
import { YieldStrategyStep } from './purchase/YieldStrategyStep';

export interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticketCount: number) => void;
}

export default function PurchaseModal({ isOpen, onClose, onSuccess }: PurchaseModalProps) {
  const { isConnected, connect } = useWalletConnection();
  const successToast = useSuccessToast();
  const errorToast = useErrorToast();
  const { jackpotStats, prizeAmount, isLoading: jackpotLoading, error: jackpotError, refresh: refreshLottery } = useLottery();
  const {
    // State
    isInitializing,
    isPurchasing,
    isApproving,
    isCheckingBalance,
    userBalance,
    ticketPrice,
    lastTxHash,
    error,
    purchaseSuccess,
    purchasedTicketCount,
    // NEAR status
    nearStages,
    nearRecipient,
    nearEthBalance,
    nearEstimatedFeeEth,
    // Actions
    purchaseTickets,
    refreshBalance,
    retryAfterFunding,
    clearError,
    reset
  } = useTicketPurchase();

  const [ticketCount, setTicketCount] = useState(1);
  const [step, setStep] = useState<'mode' | 'yield' | 'select' | 'confirm' | 'processing' | 'success' | 'share'>('mode');
  const [purchaseMode, setPurchaseMode] = useState<'individual' | 'syndicate'>('individual');
  const [selectedSyndicate, setSelectedSyndicate] = useState<SyndicateInfo | null>(null);
  const [selectedVaultStrategy, setSelectedVaultStrategy] = useState<SyndicateInfo['vaultStrategy'] | null>(null);
  const [yieldToTicketsPercentage, setYieldToTicketsPercentage] = useState<number>(85);
  const [yieldToCausesPercentage, setYieldToCausesPercentage] = useState<number>(15);
  const [syndicates, setSyndicates] = useState<SyndicateInfo[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  // Compute odds using authoritative API data (no estimates)
  // Only show odds when we have real jackpot data
  const oddsInfo = useMemo(() => {
    if (jackpotLoading || !jackpotStats) {
      return null;
    }

    // Prefer API-provided oddsPerTicket; fallback to ticketsSoldCount if available
    const baseOddsRaw =
      jackpotStats.oddsPerTicket && Number(jackpotStats.oddsPerTicket) > 0
        ? Number(jackpotStats.oddsPerTicket)
        : (typeof jackpotStats.ticketsSoldCount === 'number' && jackpotStats.ticketsSoldCount > 0
          ? Number(jackpotStats.ticketsSoldCount)
          : null);

    if (!baseOddsRaw || baseOddsRaw <= 0) {
      return null;
    }

    const formatOdds = (tickets: number) => {
      const divisor = Math.max(1, tickets);
      const x = Math.ceil(baseOddsRaw / divisor);
      return x <= 1 ? 'Better than 1:1' : `1 in ${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    };

    return {
      oddsPerTicket: baseOddsRaw,
      oddsForTickets: (tickets: number) => Math.max(1, baseOddsRaw / Math.max(1, tickets)),
      oddsFormatted: formatOdds,
      potentialWinnings: jackpotStats.prizeUsd,
    };
  }, [jackpotLoading, jackpotStats]);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTicketCount(1);
      setStep('mode');
      setPurchaseMode('individual');
      setSelectedSyndicate(null);
      clearError();

      // Refresh lottery data if we don't have it or it's stale
      if (!jackpotStats || jackpotError) {
        refreshLottery();
      }

      // Fetch syndicates data
      fetchSyndicates();
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, clearError, jackpotStats, jackpotError, refreshLottery]);

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
      // Use the enhanced purchaseTickets function with syndicate and yield strategy support
      const result = await purchaseTickets(
        ticketCount,
        purchaseMode === 'syndicate' ? selectedSyndicate?.id : undefined,
        selectedVaultStrategy || undefined,
        yieldToTicketsPercentage,
        yieldToCausesPercentage
      );

      if (result.success) {
        setStep('success');
      } else {
        setStep('select');
        // Show error toast
        const errorMessage = result.error || 'Unable to complete ticket purchase. Please try again.';
        errorToast(
          'Purchase Failed',
          errorMessage,
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

  const renderStep = () => {
    switch (step) {
      case 'mode':
        return (
          <ModeStep
            purchaseMode={purchaseMode}
            setPurchaseMode={setPurchaseMode}
            selectedSyndicate={selectedSyndicate}
            setSelectedSyndicate={setSelectedSyndicate}
            syndicates={syndicates}
            setStep={() => setStep('yield')}
          />
        );
      case 'yield':
        return (
          <YieldStrategyStep
            selectedStrategy={selectedVaultStrategy}
            onStrategySelect={setSelectedVaultStrategy}
            ticketsAllocation={yieldToTicketsPercentage}
            causesAllocation={yieldToCausesPercentage}
            onAllocationChange={(tickets, causes) => {
              setYieldToTicketsPercentage(tickets);
              setYieldToCausesPercentage(causes);
            }}
            onNext={() => setStep('select')}
            onBack={() => setStep('mode')}
          />
        );
      case 'select':
        return (
          <SelectStep
            setStep={setStep as (step: 'mode') => void}
            selectedSyndicate={selectedSyndicate}
            prizeAmount={prizeAmount}
            jackpotLoading={jackpotLoading}
            jackpotError={jackpotError}
            ticketPrice={ticketPrice}
            ticketCount={ticketCount}
            setTicketCount={setTicketCount}
            quickAmounts={quickAmounts}
            totalCost={totalCost}
            oddsInfo={oddsInfo}
            hasInsufficientBalance={hasInsufficientBalance}
            refreshBalance={refreshBalance}
            isConnected={isConnected}
            handlePurchase={handlePurchase}
            isPurchasing={isPurchasing}
            isInitializing={isInitializing}
            purchaseMode={purchaseMode}
          />
        );
      case 'processing':
        return (
          <ProcessingStep
            isApproving={isApproving}
            nearStages={nearStages}
            nearRecipient={nearRecipient}
            nearEthBalance={nearEthBalance}
            nearEstimatedFeeEth={nearEstimatedFeeEth}
            onRetryAfterFunding={retryAfterFunding}
          />
        );
      case 'success':
        return (
          <SuccessStep
            purchaseMode={purchaseMode}
            purchasedTicketCount={purchasedTicketCount}
            selectedSyndicate={selectedSyndicate}
            lastTxHash={lastTxHash}
            onClose={onClose}
            setShowShareModal={setShowShareModal}
          />
        );
      default:
        return null;
    }
  };

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
                  step === 'yield' ? '💰 Yield Strategy' :
                    selectedSyndicate ? `🌊 ${selectedSyndicate.name}` : '🎫 Buy Tickets'}
            </h2>
            {selectedSyndicate && step !== 'mode' && step !== 'yield' && (
              <p className="text-sm text-gray-400 mt-1">
                Supporting {selectedSyndicate.cause.name} • {selectedSyndicate.membersCount.toLocaleString()} members
              </p>
            )}
            {step === 'yield' && (
              <p className="text-sm text-gray-400 mt-1">
                Choose how your capital generates yield to support causes and amplify participation
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
        {renderStep()}

        {/* Share Modal */}
        {showShareModal && (
          <ShareModal
            setShowShareModal={setShowShareModal}
            purchasedTicketCount={purchasedTicketCount}
            prizeAmount={prizeAmount}
            oddsInfo={oddsInfo}
          />
        )}
      </div>
    </div>
  );
}