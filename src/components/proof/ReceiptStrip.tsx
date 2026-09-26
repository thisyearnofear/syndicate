"use client";

/**
 * RECEIPT STRIP — the single proof object.
 *
 * Every money claim ends here: status dot + label + mono hash + explorer
 * link + age. No receipt = not complete. Neutral register, mono hash only.
 * Never paints "verified" without a tx hash.
 */

import { ExternalLink } from "lucide-react";
import { RECEIPT } from "@/config/design";

export function shortHash(hash: string): string {
  if (hash.length < 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export type ReceiptStatus = "verified" | "pending" | "absorbed";

/** Honesty: verified requires a hash. Callers that omit one get absorbed. */
export function resolveReceiptStatus(
  status: ReceiptStatus | undefined,
  txHash?: string | null,
): ReceiptStatus {
  const requested = status ?? "verified";
  if (requested === "verified" && !txHash) return "absorbed";
  return requested;
}

interface ReceiptStripProps {
  label: string;
  txHash?: string | null;
  explorerUrl?: string | null;
  at?: number | null;
  status?: ReceiptStatus;
  compact?: boolean;
  className?: string;
  /** Fired when the explorer link is opened — for proof-audit instrumentation. */
  onOpen?: () => void;
}

export function ReceiptStrip({
  label,
  txHash,
  explorerUrl,
  at,
  status = "verified",
  compact = false,
  className = "",
  onOpen,
}: ReceiptStripProps) {
  const resolved = resolveReceiptStatus(status, txHash);
  const dot =
    resolved === "verified"
      ? RECEIPT.dotVerified
      : resolved === "pending"
        ? RECEIPT.dotPending
        : RECEIPT.dotAbsorbed;
  const statusText =
    resolved === "verified"
      ? "verified"
      : resolved === "pending"
        ? "pending"
        : "operator-absorbed";
  const statusTone =
    resolved === "verified"
      ? RECEIPT.verified
      : resolved === "pending"
        ? RECEIPT.pending
        : RECEIPT.absorbed;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${compact ? "text-[11px]" : "text-xs"} text-gray-400 ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
      {txHash && explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
          className={`inline-flex items-center gap-1 ${RECEIPT.hash} underline-offset-2 hover:text-white hover:underline`}
        >
          {shortHash(txHash)}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : txHash ? (
        <span className={RECEIPT.hash}>{shortHash(txHash)}</span>
      ) : null}
      <span className={statusTone}>{statusText}</span>
      {at ? <span className="text-gray-600">· {timeAgo(at)}</span> : null}
    </span>
  );
}
