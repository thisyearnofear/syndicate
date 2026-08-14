'use client';

/**
 * SEASON SHARE CARDS — shareable moments for the Tontine Pot game.
 *
 * Every settlement, seat-freedom, bid win, and streak produces a named,
 * attributed share card. Cards link out to Farcaster (Warpcast compose) and
 * Twitter intents via socialService, so there is no server-side posting and
 * nothing is fabricated client-side — the user reviews and sends the cast.
 *
 * Per docs/DESIGN.md the card carries the crew crest accent and a named
 * handle; per docs/SEASON.md these are the "named person to point at"
 * virality moments.
 */

import { useState } from 'react';
import { Share2, Check, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { socialService } from '@/services/socialService';

export interface ShareCardData {
  title: string;
  body: string;
  /** Farcaster channel id for the cast. */
  channelId?: string;
  /** Optional URL to embed / link. */
  url?: string;
  /** Accent token from src/config/design.ts (maps to a crest color). */
  accent?: string;
}

interface ShareCardsProps {
  data: ShareCardData;
  compact?: boolean;
  className?: string;
}

const ACCENT_CLASS: Record<string, string> = {
  play: 'border-amber-400/40 bg-amber-500/10',
  grow: 'border-emerald-400/40 bg-emerald-500/10',
  coordinate: 'border-violet-400/40 bg-violet-500/10',
  autopilot: 'border-sky-400/40 bg-sky-500/10',
  // Arena surface (Season) — brass on ink, per docs/DESIGN.md.
  arena: 'border-[#c9a227]/40 bg-[#c9a227]/10',
};

export function ShareCards({ data, compact = false, className = '' }: ShareCardsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const accentClass = ACCENT_CLASS[data.accent ?? 'coordinate'] ?? ACCENT_CLASS.coordinate;
  const platformUrl = data.url ?? (typeof window !== 'undefined' ? window.location.origin : '');

  const twitterText = `${data.title} ${data.body}`.trim();
  const twitterUrl = socialService.generateTwitterUrl(twitterText, platformUrl);
  const farcasterUrl = socialService.generateFarcasterUrl(
    `${data.title} ${data.body}`.trim(),
    [platformUrl],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${data.title} ${data.body}\n${platformUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <a
          href={farcasterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-violet-300 hover:underline underline-offset-4"
        >
          Share to Farcaster
        </a>
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-sky-300 hover:underline underline-offset-4"
        >
          Share to X
        </a>
      </span>
    );
  }

  return (
    <div className={`rounded-2xl border ${accentClass} p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{data.title}</p>
          <p className="text-xs text-gray-300 mt-1 whitespace-pre-wrap break-words">{data.body}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/15 bg-slate-900/60 px-2.5 py-1.5 text-xs font-semibold text-gray-200 hover:bg-slate-900"
          aria-label="Share this moment"
        >
          {open ? <X className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
          {open ? 'Close' : 'Share'}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={farcasterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/25"
          >
            Farcaster
          </a>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
          >
            X / Twitter
          </a>
          <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
            {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : null}
            {copied ? 'Copied' : 'Copy text'}
          </Button>
        </div>
      )}
    </div>
  );
}
