"use client";

import { useSearchParams } from "next/navigation";
import { CrossChainTracker } from "@/components/bridge/CrossChainTracker";
import { usePurchaseStatusTracker } from "@/domains/participation/hooks/usePurchaseStatusTracker";
import type { SourceChainType } from "@/domains/participation/types";

export default function PurchaseStatusPage() {
  const searchParams = useSearchParams();
  const txId = searchParams?.get("txId") ?? null;
  const chainParam = (searchParams?.get("chain") as SourceChainType | null) || undefined;

  const {
    trackerStatus,
    data,
    sourceChain,
    copied,
    sourceExplorerUrl,
    showSolanaAdapterWarning,
    copyShareLink,
  } = usePurchaseStatusTracker(txId, chainParam);

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-white">Purchase Status</h1>
          <p className="text-gray-400 mt-2">
            Tracking your cross-chain purchase. This page will auto-update.
          </p>
          {txId && (
            <p className="text-xs text-gray-500 mt-2 font-mono break-all">
              {txId}
            </p>
          )}
        </div>

        <CrossChainTracker
          status={trackerStatus}
          sourceChain={sourceChain}
          sourceTxId={txId || undefined}
          baseTxId={data?.baseTxId}
          error={data?.error || null}
          receipt={{
            stacksExplorer: data?.receipt?.stacksExplorer,
            sourceExplorer: data?.receipt?.sourceExplorer || sourceExplorerUrl,
            baseExplorer: data?.receipt?.baseExplorer ?? null,
            megapotApp: data?.receipt?.megapotApp ?? null,
          }}
        />
        {data?.updatedAt && (
          <p className="mt-3 text-xs text-gray-500">
            Last updated: {new Date(data.updatedAt).toLocaleString()}
          </p>
        )}
        {txId && (
          <div className="mt-4 flex items-center gap-3">
            <a
              href={`/purchase-status?txId=${txId}&chain=${sourceChain}`}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Share Status Page
            </a>
            <button
              type="button"
              onClick={copyShareLink}
              className="text-xs text-gray-300 hover:text-white"
            >
              {copied ? "Copied" : "Copy Link"}
            </button>
          </div>
        )}
        {showSolanaAdapterWarning && (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-amber-300 text-sm font-medium">
              Solana intent adapter not configured
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Purchases may require an EVM wallet to finalize on Base. Set
              `NEXT_PUBLIC_DEBRIDGE_ADAPTER` to enable single‑wallet execution.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
