"use client";

import { Button } from "@/shared/components/ui/Button";
import { CompactStack, CompactFlex } from "@/shared/components/premium/CompactLayout";
import { ExternalLink, Share2 } from 'lucide-react';
import type { SyndicateInfo } from "@/domains/lottery/types";

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
    </CompactStack>
  );
}
