"use client";

import { useState } from 'react';
import { Button } from "@/shared/components/ui/Button";
import { CompactStack, CompactFlex } from "@/shared/components/premium/CompactLayout";
import { ExternalLink, Share2, Zap } from 'lucide-react';
import { AutoPurchasePermissionModal } from "@/components/modal/AutoPurchasePermissionModal";
import { useAdvancedPermissions, useCanEnableAutoPurchase } from "@/hooks/useAdvancedPermissions";
import type { SyndicateInfo } from "@/domains/lottery/types";
import type { AutoPurchaseConfig } from "@/domains/wallet/types";

interface SuccessStepProps {
  purchaseMode: 'individual' | 'syndicate' | 'yield';
  purchasedTicketCount: number;
  selectedSyndicate: SyndicateInfo | null;
  lastTxHash: string | null;
  onClose: () => void;
  setShowShareModal: (show: boolean) => void;
}

export function SuccessStep({
  purchaseMode,
  purchasedTicketCount,
  selectedSyndicate,
  lastTxHash,
  onClose,
  setShowShareModal,
}: SuccessStepProps) {
  const [showAutoPermissionModal, setShowAutoPermissionModal] = useState(false);
  const { saveAutoPurchaseConfig } = useAdvancedPermissions();
  const { canEnable, reason } = useCanEnableAutoPurchase();

  // CLEAN: Handle successful permission grant
  const handleAutoPurchaseSuccess = (config: AutoPurchaseConfig) => {
    // Save config to state and localStorage
    saveAutoPurchaseConfig(config);
    setShowAutoPermissionModal(false);
    // User can continue or close the modal
  };

  return (
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
              Supporting {selectedSyndicate.cause.name}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              You&#39;re member #{selectedSyndicate.membersCount + 1}!
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
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* ENHANCEMENT: Auto-Purchase Option (MetaMask only) */}
      {canEnable && (
        <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 rounded-lg p-4 w-full">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-white font-semibold mb-2">Never Miss a Ticket</p>
              <p className="text-gray-300 text-sm mb-3">
                Enable automatic weekly or monthly purchases so you always have tickets in the draw.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAutoPermissionModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"
              >
                Enable Auto-Purchase
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Show reason if auto-purchase unavailable */}
      {!canEnable && reason && typeof reason === 'string' && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 w-full text-center">
          <p className="text-xs text-gray-400">{reason}</p>
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
            <Share2 className="w-4 h-4 mr-2" />
            Share Win
          </Button>
        </CompactFlex>

        <Button
          variant="outline"
          size="lg"
          onClick={onClose}
          className="w-full border-white/20 text-white hover:bg-white/10"
        >
          Continue Playing
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Your tickets are now active for the next draw
      </p>

      {/* Auto-Purchase Permission Modal */}
      <AutoPurchasePermissionModal
        isOpen={showAutoPermissionModal}
        onClose={() => setShowAutoPermissionModal(false)}
        onSuccess={handleAutoPurchaseSuccess}
      />
    </CompactStack>
  );
}
