/**
 * SHARE MODAL - User Delight Feature
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: Enhances user experience after purchase
 * - CLEAN: Focused on sharing functionality
 * - MODULAR: Standalone component
 */

import React from 'react';
import { X, Twitter, Copy, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketCount: number;
  prizeAmount?: string | number;
  syndicateName?: string;
}

export function ShareModal({ isOpen, onClose, ticketCount, prizeAmount, syndicateName }: ShareModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const shareText = syndicateName 
    ? `Just joined the ${syndicateName} syndicate with ${ticketCount} tickets! 🎯`
    : `Just bought ${ticketCount} lottery tickets! 🎫`;

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <PuzzlePiece variant="primary" size="lg" className="max-w-md w-full mx-4">
        <CompactStack spacing="lg">
          <CompactFlex align="center" justify="between">
            <h3 className="text-xl font-bold text-white">Share Your Entry! 🎉</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </CompactFlex>

          <div className="text-center">
            <p className="text-gray-300 mb-4">{shareText}</p>
            {prizeAmount && (
              <p className="text-sm text-yellow-400">
                Prize Pool: ${prizeAmount}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleTwitterShare}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600"
            >
              <Twitter className="w-4 h-4" />
              Twitter
            </Button>
            
            <Button
              onClick={handleCopy}
              variant="secondary"
              className="flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          <Button onClick={onClose} variant="secondary" className="w-full">
            Close
          </Button>
        </CompactStack>
      </PuzzlePiece>
    </div>
  );
}