/**
 * PURCHASE RECEIPT — Success step of the purchase modal.
 *
 * Displays:
 *   - Confirmation with ticket count
 *   - Transaction explorer links
 *   - Cross-chain tracker (for bridged purchases still completing)
 *   - Auto-purchase upsell (when applicable)
 *   - Buy More / Done actions
 */

"use client";

import { Button } from "@/shared/components/ui/Button";
import { Check, ExternalLink, Zap } from "lucide-react";
import { CompactStack } from "@/shared/components/premium/CompactLayout";
import { CrossChainTracker } from "@/components/bridge/CrossChainTracker";
import type { SourceChainType, TrackerStatus } from "@/domains/participation/types";

interface PurchaseReceiptProps {
  ticketCount: number;
  txHash?: string | null;
  sourceTxHash?: string | null;
  destinationTxHash?: string | null;
  sourceChain?: SourceChainType;
  status: TrackerStatus;
  error?: string | null;
  walletInfo?: { sourceAddress?: string; baseAddress?: string; isLinked?: boolean };
  walletType?: string | null;
  hasActivePermission: boolean;
  isERC7715Supported: boolean;
  onBuyMore: () => void;
  onClose: () => void;
  onEnableAutoPurchase: () => void;
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

export function PurchaseReceipt({
  ticketCount,
  txHash,
  sourceTxHash,
  destinationTxHash,
  sourceChain,
  status,
  error,
  walletInfo,
  walletType,
  hasActivePermission,
  isERC7715Supported,
  onBuyMore,
  onClose,
  onEnableAutoPurchase,
}: PurchaseReceiptProps) {
  const isCrossChain = sourceChain && sourceChain !== "base" && sourceChain !== "ethereum";
  const showTracker = isCrossChain && sourceTxHash;

  // Cross-chain: show tracker with inline actions
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
            <a
              href={`/purchase-status?txId=${sourceTxHash}&chain=${sourceChain}`}
              className="inline-block text-sm text-blue-400 hover:text-blue-300"
            >
              Open Status Page
            </a>
          )}
          <div className="flex gap-3 mt-3">
            <Button variant="outline" className="flex-1" onClick={onBuyMore}>Buy More</Button>
            <Button variant="default" className="flex-1" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    );
  }

  // Direct (Base-native) success
  return (
    <CompactStack spacing="md" align="center">
      <div className="text-center">
        <div className="inline-block mb-4">
          <div className="w-16 h-16 rounded-full bg-green-400/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" aria-label="Success" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Public Play Confirmed!</h2>
        <p className="text-gray-400 mb-2">
          You purchased {ticketCount} ticket{ticketCount !== 1 ? "s" : ""}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mb-2">
          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
            >
              View Transaction <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <a
            href="https://docs.megapot.io/overview/prizes"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-yellow-400 hover:text-yellow-300 inline-flex items-center gap-1"
          >
            Prize Info <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-xs text-gray-500">
          Winners are drawn on-chain. Prizes are paid instantly to your wallet — no claiming needed.
        </p>
      </div>

      {/* Auto-purchase upsell */}
      {!hasActivePermission && isERC7715Supported && walletType === "evm" && (
        <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-blue-300 mb-1">Never sign again</p>
            <p className="text-xs text-gray-300">
              Enable auto-purchase to buy tickets daily without signing. Powered by your wallet&apos;s built-in spending controls.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="w-full text-xs" onClick={onEnableAutoPurchase}>
            <Zap className="w-3 h-3 mr-1" /> Enable Auto-Purchase
          </Button>
        </div>
      )}

      {walletType === "stacks" && (
        <div className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-purple-300 mb-1">Automate your purchases</p>
            <p className="text-xs text-gray-300">
              Set up recurring ticket purchases with a one-time wallet authorization. Sign once, buy tickets automatically every week or month.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="w-full text-xs" onClick={onEnableAutoPurchase}>
            <Zap className="w-3 h-3 mr-1" /> Enable Auto-Purchase
          </Button>
        </div>
      )}

      <div className="flex gap-3 w-full">
        <Button variant="outline" className="flex-1" onClick={onBuyMore}>Buy More</Button>
        <Button variant="default" className="flex-1" onClick={onClose}>Done</Button>
      </div>
    </CompactStack>
  );
}
