"use client";

/**
 * STATE VIEWS — one grammar for every page's nothing/loading/disconnected
 * moments (docs/DESIGN.md).
 *
 * - PageSkeleton: honest pulse blocks that mirror the page's card rhythm.
 * - EmptyState: a designed moment, never dead space — icon tile in the
 *   domain accent, one sentence of truth, and (when helpful) a single
 *   action. Sparse pages feel sparse because of naked emptiness; an
 *   EmptyState is content.
 * - DisconnectedState: consistent "connect wallet" moment across wallet-
 *   gated pages; callers pass the page's existing connect UI via children.
 */

import { type ReactNode } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { ACCENTS, type DesignAccent } from "@/config/design";

// ─── PageSkeleton ───────────────────────────────────────────────────────────

interface PageSkeletonProps {
  /** Number of card-shaped pulse blocks */
  cards?: number;
  /** Render as a 2-col grid on md+ */
  grid?: boolean;
}

export function PageSkeleton({ cards = 4, grid = false }: PageSkeletonProps) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-white/10" />
        <div className="mt-2 h-4 w-72 rounded bg-white/5" />
        <div className="mt-5 h-px w-24 rounded bg-white/10" />
      </div>
      <div className={`mt-8 animate-pulse ${grid ? "grid gap-4 md:grid-cols-2" : "space-y-4"}`}>
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/[0.04] border border-white/10" />
        ))}
      </div>
    </div>
  );
}

// ─── EmptyState ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  hint: string;
  accent?: DesignAccent;
  action?: { label: string; href: string } | { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, hint, accent = "neutral", action }: EmptyStateProps) {
  const a = ACCENTS[accent];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
      {icon && (
        <div className={`w-12 h-12 mx-auto mb-4 rounded-xl ${a.tile} flex items-center justify-center`}>
          <span className={a.icon}>{icon}</span>
        </div>
      )}
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-gray-400 max-w-sm mx-auto">{hint}</p>
      {action && (
        "href" in action ? (
          <Link
            href={action.href}
            className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${a.icon} hover:underline underline-offset-4`}
          >
            {action.label} &rarr;
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${a.icon} hover:underline underline-offset-4`}
          >
            {action.label} &rarr;
          </button>
        )
      )}
    </div>
  );
}

// ─── DisconnectedState ──────────────────────────────────────────────────────

interface DisconnectedStateProps {
  /** What the wallet unlocks: "Your tickets", "Your portfolio" */
  subject: string;
  accent?: DesignAccent;
  /** Optional connect UI (RainbowKit button etc.); when omitted, a hint line shows */
  children?: ReactNode;
}

export function DisconnectedState({ subject, accent = "neutral", children }: DisconnectedStateProps) {
  const a = ACCENTS[accent];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center max-w-md mx-auto">
      <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl ${a.tile} flex items-center justify-center`}>
        <Wallet className={`w-6 h-6 ${a.icon}`} />
      </div>
      <p className="text-xl font-bold text-white">{subject}</p>
      <p className="mt-2 text-sm text-gray-400">
        Connect a wallet to see what&apos;s yours. Non-custodial — your keys, your funds.
      </p>
      {children && <div className="mt-6 flex justify-center">{children}</div>}
    </div>
  );
}
