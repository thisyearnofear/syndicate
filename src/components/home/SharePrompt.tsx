"use client";

/**
 * SHARE PROMPT — Appears after a successful ticket purchase.
 * Creates a viral loop: purchase → share → friend enters → repeat.
 */

import { useState, useEffect, useCallback } from "react";
import { X, Share2, Check } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";

interface SharePromptProps {
  /** Number of tickets just purchased */
  ticketCount: number;
  /** Draw number user entered */
  drawId?: number;
  /** Dismiss handler */
  onDismiss: () => void;
}

export function SharePrompt({ ticketCount, drawId, onDismiss }: SharePromptProps) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const shareText = `Just entered${drawId ? ` draw #${drawId}` : ''} on Syndicate with ${ticketCount} ticket${ticketCount !== 1 ? 's' : ''}. $1 entry, keep your principal forever. No-loss lottery on Base.`;
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://syndicate.io';

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url: shareUrl });
      } catch {}
    } else {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareText, shareUrl]);

  return (
    <div
      className={`fixed inset-x-0 bottom-20 md:bottom-auto md:top-8 md:right-8 md:left-auto z-50 mx-4 md:mx-0 md:w-80 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-5 shadow-2xl">
        {/* Close */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full bg-brand-500/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-brand-400" />
          </div>
          <p className="text-sm text-white font-medium">
            You&apos;re in. {ticketCount} ticket{ticketCount !== 1 ? 's' : ''} entered.
          </p>
          <p className="text-xs text-gray-500">
            Tell a friend — more players, bigger pool.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full border border-white/10 hover:border-brand-400/30 text-gray-300 hover:text-white"
            onClick={handleShare}
          >
            <Share2 className="w-3.5 h-3.5 mr-2" />
            {copied ? 'Copied!' : 'Share'}
          </Button>
        </div>
      </div>
    </div>
  );
}
