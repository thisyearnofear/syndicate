"use client";

/**
 * POLICY APPROVAL CARD — BeautifulUI Approval Card, Syndicate translation.
 *
 * Bounds + approve/skip + revoke + optional replay link. Consumer surfaces
 * say "enters every draw for you", never "autonomous economic actor".
 * Presentation only — callers own the wallet/relayer side effects.
 */

import Link from "next/link";
import { Button } from "@/shared/components/ui/Button";

export interface PolicyBound {
  label: string;
  value: string;
}

interface PolicyApprovalCardProps {
  title?: string;
  mechanism?: string;
  description?: string;
  bounds: PolicyBound[];
  revokeHref?: string;
  revokeLabel?: string;
  onRevoke?: () => void;
  replayHref?: string;
  onApprove?: () => void;
  onSkip?: () => void;
  approveLabel?: string;
  skipLabel?: string;
  approveDisabled?: boolean;
  approving?: boolean;
  className?: string;
}

export function PolicyApprovalCard({
  title = "Policy",
  mechanism = "Enters every draw for you — within these bounds.",
  description,
  bounds,
  revokeHref = "/settings",
  revokeLabel = "Revoke anytime from Settings",
  onRevoke,
  replayHref = "/operators",
  onApprove,
  onSkip,
  approveLabel = "Approve",
  skipLabel = "Skip",
  approveDisabled = false,
  approving = false,
  className = "",
}: PolicyApprovalCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3 ${className}`}
      role="region"
      aria-label={title}
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
          {title}
        </p>
        <p className="mt-1 text-sm font-medium text-white">{mechanism}</p>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-gray-400">{description}</p>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {bounds.map((b) => (
          <div
            key={b.label}
            className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2"
          >
            <dt className="text-[10px] uppercase tracking-wider text-gray-500">{b.label}</dt>
            <dd className="mt-0.5 font-mono text-xs text-gray-200">{b.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        {onRevoke ? (
          <button
            type="button"
            onClick={onRevoke}
            className="text-gray-400 underline-offset-2 hover:text-white hover:underline"
          >
            {revokeLabel}
          </button>
        ) : (
          <Link
            href={revokeHref}
            className="text-gray-400 underline-offset-2 hover:text-white hover:underline"
          >
            {revokeLabel}
          </Link>
        )}
        <Link
          href={replayHref}
          className="text-gray-400 underline-offset-2 hover:text-white hover:underline"
        >
          Replay operators →
        </Link>
      </div>

      {(onApprove || onSkip) && (
        <div className="flex gap-2 pt-1">
          {onSkip ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-white/15"
              onClick={onSkip}
              disabled={approving}
            >
              {skipLabel}
            </Button>
          ) : null}
          {onApprove ? (
            <Button
              type="button"
              variant="warning"
              className="flex-1"
              onClick={onApprove}
              disabled={approveDisabled || approving}
            >
              {approving ? "Approving…" : approveLabel}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
