"use client";

import { Button } from "@/shared/components/ui/Button";
import { CompactStack, CompactFlex } from "@/shared/components/premium/CompactLayout";
import { Twitter, MessageCircle } from 'lucide-react';
import { socialService } from '@/services/socialService';

interface ShareModalProps {
  setShowShareModal: (show: boolean) => void;
  purchasedTicketCount: number;
  prizeAmount: number | undefined;
  oddsInfo: {
    oddsFormatted: (tickets: number) => string;
  } | null;
}

export function ShareModal({
  setShowShareModal,
  purchasedTicketCount,
  prizeAmount,
  oddsInfo,
}: ShareModalProps) {
  return (
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
                  jackpotAmount: prizeAmount?.toString() || '0',
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
                  jackpotAmount: prizeAmount?.toString() || '0',
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
  );
}
