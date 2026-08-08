/**
 * PURCHASE PROGRESS — Processing step of the purchase modal.
 *
 * Displays:
 *   - Cross-chain tracker (when source chain != base)
 *   - Step indicators for multi-step flows
 *   - Fallback spinner for direct purchases
 *   - Live status link + copy functionality
 *
 * Reads from the useUnifiedPurchase execution state and legacy TrackerStatus.
 */

"use client";

import { useState } from "react";
import { Loader, Check, Link2 } from "lucide-react";
import { CrossChainTracker } from "@/components/bridge/CrossChainTracker";
import type { SourceChainType, TrackerStatus } from "@/domains/participation/types";
import type { ExecutionState } from "@/services/execution";

interface PurchaseProgressProps {
  /** Execution state machine from useUnifiedPurchase. */
  execution: ExecutionState;
  /** Legacy tracker status. */
  status: TrackerStatus;
  /** Source chain of the purchase. */
  sourceChain?: SourceChainType;
  /** Wallet type (stacks, solana, near, starknet, evm). */
  walletType?: string | null;
  /** Number of tickets being purchased. */
  ticketCount: number;
  /** Source-chain transaction hash. */
  sourceTxHash?: string | null;
  /** Destination-chain (Base) transaction hash. */
  destinationTxHash?: string | null;
  /** Direct transaction hash (Base-native purchase). */
  txHash?: string | null;
  /** Error message. */
  error?: string | null;
  /** Cross-chain wallet info. */
  walletInfo?: { sourceAddress?: string; baseAddress?: string; isLinked?: boolean };
}

const getExplorerUrl = (chain: SourceChainType, txHash: string): string => {
  switch (chain) {
    case "solana": return `https://solscan.io/tx/${txHash}`;
    case "near": return `https://explorer.near.org/transactions/${txHash}`;
    case "stacks": return `https://explorer.stacks.co/txid/${txHash}?chain=mainnet`;
    case "base": return `https://basescan.org/tx/${txHash}`;
    case "ethereum": return `https://etherscan.io/tx/${txHash}`;
    default: return "#";
  }
};

export function PurchaseProgress({
  status,
  sourceChain,
  ticketCount,
  sourceTxHash,
  destinationTxHash,
  txHash,
  error,
  walletInfo,
}: PurchaseProgressProps) {
  const [statusLinkCopied, setStatusLinkCopied] = useState(false);

  const isCrossChain = sourceChain && sourceChain !== "base" && sourceChain !== "ethereum";
  const showTracker = ["confirmed_source", "confirmed_stacks", "bridging", "purchasing", "complete", "error"].includes(status);

  const handleCopyStatusLink = async () => {
    if (!sourceTxHash || !sourceChain) return;
    const url = `${window.location.origin}/purchase-status/track?txId=${sourceTxHash}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatusLinkCopied(true);
      setTimeout(() => setStatusLinkCopied(false), 2000);
    } catch {}
  };

  // Cross-chain tracker view
  if (showTracker && sourceChain) {
    const explorerUrl = sourceTxHash ? getExplorerUrl(sourceChain, sourceTxHash) : undefined;
    return (
      <div aria-live="polite">
        <CrossChainTracker
          status={status}
          sourceChain={sourceChain}
          sourceTxId={sourceTxHash ?? undefined}
          baseTxId={destinationTxHash ?? undefined}
          error={error ?? undefined}
          ticketCount={ticketCount}
          walletInfo={walletInfo}
          receipt={{
            sourceExplorer: explorerUrl,
            baseExplorer: destinationTxHash ? `https://basescan.org/tx/${destinationTxHash}` : undefined,
            megapotApp: `/my-tickets`,
          }}
        />
        <div className="mt-4">
          {sourceTxHash && (
            <div className="flex items-center gap-3">
              <a
                href={`/purchase-status/track?txId=${sourceTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Open Live Tracker →
              </a>
              <button
                type="button"
                onClick={handleCopyStatusLink}
                className="text-xs text-gray-300 hover:text-white inline-flex items-center gap-1"
              >
                <Link2 className="w-3 h-3" />
                {statusLinkCopied ? "Copied" : "Copy Link"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback: step-by-step loading for cross-chain wallets
  const steps = isCrossChain
    ? [
        { label: "Signing transaction", done: !!sourceTxHash },
        { label: "Waiting for confirmation", done: status === "bridging" || status === "purchasing" || status === "complete" },
        { label: "Bridging to Base", done: status === "purchasing" || status === "complete" },
        { label: "Minting public-play tickets", done: status === "complete" },
      ]
    : null;

  return (
    <div className="text-center py-8" aria-live="polite" aria-busy="true">
      <div className="inline-block mb-6">
        <Loader className="w-12 h-12 text-blue-400 animate-spin" aria-label="Processing" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Processing Public Play</h2>
      <p className="text-gray-400 mb-6">
        {isCrossChain
          ? "Bridging across chains — this takes 2-3 minutes"
          : "Executing transaction..."}
      </p>

      {steps && (
        <div className="text-left space-y-3 max-w-xs mx-auto" role="list" aria-label="Transaction progress">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3" role="listitem">
              {s.done
                ? <Check className="w-4 h-4 text-green-400 flex-shrink-0" aria-label="Complete" />
                : <div className="w-4 h-4 rounded-full border-2 border-gray-600 flex-shrink-0" aria-label="Pending" />}
              <span className={`text-sm ${s.done ? "text-green-300" : "text-gray-500"}`}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {txHash && (
        <p className="text-xs text-gray-500 font-mono break-all mt-4">{txHash}</p>
      )}
    </div>
  );
}
