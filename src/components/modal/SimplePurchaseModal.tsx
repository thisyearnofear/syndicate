/**
 * SIMPLIFIED PURCHASE MODAL
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Replaces 418-line PurchaseModal with streamlined version
 * - CLEAN: Single responsibility - purchase UX flow
 * - MODULAR: Uses useSimplePurchase hook + orchestrator
 * 
 * Replaces: PurchaseModal.tsx (418 lines)
 * Consolidates: ModeStep, SelectStep, ProcessingStep, SuccessStep
 * 
 * Flow: Connect → Select Chain/Amount → Execute → Success
 * No yield/syndicate features in MVP
 */

import { useState, Suspense, lazy } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useSimplePurchase } from '@/hooks/useSimplePurchase';
import WalletConnectionManager from '@/components/wallet/WalletConnectionManager';
import { CompactStack, CompactCard } from '@/shared/components/premium/CompactLayout';

// Lazy load celebration modal
const CelebrationModal = lazy(() => import('./CelebrationModal'));

type PurchaseStep = 'connect' | 'select' | 'approve' | 'processing' | 'success';

export interface SimplePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SimplePurchaseModal({ isOpen, onClose }: SimplePurchaseModalProps) {
  const { isConnected, address, walletType } = useWalletConnection();
  const { purchase, isPurchasing, error, txHash, clearError, reset } = useSimplePurchase();
  
  const [step, setStep] = useState<PurchaseStep>('connect');
  const [ticketCount, setTicketCount] = useState(1);
  const [showCelebration, setShowCelebration] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    reset();
    setStep('connect');
    onClose();
  };

  const handlePurchaseClick = async () => {
    if (!isConnected || !address) {
      setStep('connect');
      return;
    }

    setStep('processing');
    const result = await purchase({
      ticketCount,
      userAddress: address,
    });

    if (result.success) {
      setShowCelebration(true);
      setStep('success');
    } else {
      setStep('select');
    }
  };

  // Render step content
  const renderStep = () => {
    switch (step) {
      case 'connect':
        return (
          <CompactStack spacing="md" align="center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Let's Play</h2>
              <p className="text-gray-400">Connect your wallet to purchase lottery tickets</p>
            </div>
            <WalletConnectionManager />
            <Button
              variant="outline"
              className="w-full"
              onClick={handleClose}
            >
              Close
            </Button>
          </CompactStack>
        );

      case 'select':
      case 'approve':
        return (
          <CompactStack spacing="md">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Buy Tickets</h2>
              <p className="text-gray-400 text-sm">
                Connected: <span className="text-green-400">{walletType?.toUpperCase()}</span>
              </p>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium text-sm">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-300 hover:text-red-200 mt-2 px-0"
                    onClick={clearError}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {/* Ticket count selector */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">Number of Tickets</label>
              <div className="flex items-center gap-4 bg-gray-700/50 rounded-lg p-4">
                <button
                  onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                  className="w-10 h-10 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors"
                  disabled={isPurchasing}
                >
                  −
                </button>
                <input
                  type="number"
                  value={ticketCount}
                  onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center text-2xl font-bold text-white bg-transparent focus:outline-none"
                  min="1"
                  disabled={isPurchasing}
                />
                <button
                  onClick={() => setTicketCount(ticketCount + 1)}
                  className="w-10 h-10 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors"
                  disabled={isPurchasing}
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-400">Cost: ${ticketCount} USD</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isPurchasing}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                className="flex-1 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
                onClick={handlePurchaseClick}
                disabled={isPurchasing}
              >
                {isPurchasing ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Buy Tickets'
                )}
              </Button>
            </div>
          </CompactStack>
        );

      case 'processing':
        return (
          <div className="text-center py-12">
            <div className="inline-block mb-6">
              <Loader className="w-12 h-12 text-blue-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Processing Purchase</h2>
            <p className="text-gray-400 mb-4">
              {walletType === 'stacks' || walletType === 'near'
                ? 'Bridging across chains...'
                : 'Executing transaction...'}
            </p>
            {txHash && (
              <p className="text-xs text-gray-500 font-mono break-all">{txHash}</p>
            )}
          </div>
        );

      case 'success':
        return (
          <CompactStack spacing="md" align="center">
            <div className="text-center">
              <div className="inline-block mb-4">
                <CheckCircle className="w-16 h-16 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Purchase Successful!</h2>
              <p className="text-gray-400 mb-4">
                You purchased {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
              </p>
              {txHash && (
                <a
                  href={`https://basescan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  View Transaction
                </a>
              )}
            </div>

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setTicketCount(1);
                  setStep('select');
                  clearError();
                }}
              >
                Buy More
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          </CompactStack>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Modal overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />

      {/* Modal content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <CompactCard
          variant="premium"
          padding="lg"
          className="w-full max-w-md max-h-[90vh] overflow-y-auto"
        >
          {renderStep()}
        </CompactCard>
      </div>

      {/* Celebration for success */}
      <Suspense fallback={null}>
        <CelebrationModal
          isOpen={showCelebration}
          onClose={() => setShowCelebration(false)}
          ticketCount={ticketCount}
        />
      </Suspense>
    </>
  );
}
