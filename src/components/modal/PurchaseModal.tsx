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

import { useState, useEffect } from 'react';
import { PremiumButton, JackpotButton, GhostButton } from '@/shared/components/premium/PremiumButton';
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';
import { HeadlineText, BodyText, CountUpText, PremiumBadge } from '@/shared/components/premium/Typography';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (txHash: string) => void;
}

export default function PurchaseModal({ isOpen, onClose, onSuccess }: PurchaseModalProps) {
  const [ticketCount, setTicketCount] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm' | 'processing' | 'success'>('select');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setStep('select');
      setTicketCount(1);
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handlePurchase = async () => {
    setIsPurchasing(true);
    setStep('processing');
    
    try {
      // Simulate purchase process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
      setStep('success');
      onSuccess?.(mockTxHash);
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Purchase failed:', error);
      setStep('select');
    } finally {
      setIsPurchasing(false);
    }
  };

  const quickAmounts = [1, 5, 10, 25];

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
          <HeadlineText className="text-2xl">
            {step === 'success' ? '🎉 Success!' : '🎫 Buy Tickets'}
          </HeadlineText>
          <GhostButton
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0 rounded-full"
          >
            ✕
          </GhostButton>
        </CompactFlex>

        {/* Content based on step */}
        {step === 'select' && (
          <CompactStack spacing="lg">
            {/* Quick amount selection */}
            <div>
              <BodyText size="sm" weight="medium" className="mb-3">
                Quick Select
              </BodyText>
              <CompactFlex gap="sm" className="flex-wrap">
                {quickAmounts.map((amount) => (
                  <PremiumButton
                    key={amount}
                    variant={ticketCount === amount ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => setTicketCount(amount)}
                  >
                    {amount} ticket{amount > 1 ? 's' : ''}
                  </PremiumButton>
                ))}
              </CompactFlex>
            </div>

            {/* Custom amount */}
            <div>
              <BodyText size="sm" weight="medium" className="mb-3">
                Custom Amount
              </BodyText>
              <CompactFlex align="center" gap="md" justify="center">
                <PremiumButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                  className="w-12 h-12 p-0 rounded-full"
                >
                  -
                </PremiumButton>
                
                <div className="text-center min-w-[80px]">
                  <div className="text-3xl font-black gradient-text-primary">
                    {ticketCount}
                  </div>
                  <BodyText size="xs" color="gray-400">
                    ticket{ticketCount > 1 ? 's' : ''}
                  </BodyText>
                </div>
                
                <PremiumButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setTicketCount(ticketCount + 1)}
                  className="w-12 h-12 p-0 rounded-full"
                >
                  +
                </PremiumButton>
              </CompactFlex>
            </div>

            {/* Price display */}
            <div className="glass p-6 rounded-2xl">
              <CompactFlex align="center" justify="between" className="mb-2">
                <BodyText weight="medium">Total Cost:</BodyText>
                <div className="text-3xl font-black text-green-400">
                  $<CountUpText value={ticketCount} duration={300} />
                </div>
              </CompactFlex>
              
              <CompactFlex align="center" justify="between" gap="sm" className="text-sm">
                <BodyText size="sm" color="gray-400">
                  $1 per ticket
                </BodyText>
                <PremiumBadge variant="success" size="sm">
                  🌊 Supports Ocean Cleanup
                </PremiumBadge>
              </CompactFlex>
            </div>

            {/* Purchase button */}
            <JackpotButton
              onClick={handlePurchase}
              size="lg"
              leftIcon="⚡"
              className="w-full"
            >
              Purchase {ticketCount} Ticket{ticketCount > 1 ? 's' : ''}
            </JackpotButton>

            {/* Terms */}
            <BodyText size="xs" color="gray-500" className="text-center">
              By purchasing, you agree to our terms and support ocean cleanup initiatives
            </BodyText>
          </CompactStack>
        )}

        {step === 'processing' && (
          <CompactStack spacing="lg" align="center">
            <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <HeadlineText className="text-xl">Processing Purchase...</HeadlineText>
            <BodyText color="gray-400" className="text-center">
              Please wait while we process your {ticketCount} ticket{ticketCount > 1 ? 's' : ''}
            </BodyText>
          </CompactStack>
        )}

        {step === 'success' && (
          <CompactStack spacing="lg" align="center">
            <div className="text-6xl animate-bounce">🎉</div>
            <HeadlineText className="text-xl text-center">
              Purchase Successful!
            </HeadlineText>
            <div className="glass p-4 rounded-xl text-center">
              <BodyText weight="semibold" className="mb-2">
                {ticketCount} Ticket{ticketCount > 1 ? 's' : ''} Purchased
              </BodyText>
              <BodyText size="sm" color="gray-400">
                Good luck in the draw! 🍀
              </BodyText>
            </div>
            <BodyText size="sm" color="gray-400" className="text-center">
              This modal will close automatically...
            </BodyText>
          </CompactStack>
        )}
      </div>
    </div>
  );
}