"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CrossChainTracker } from "@/components/bridge/CrossChainTracker";
import type { TrackerStatus } from "@/components/bridge/CrossChainTracker";
import { usePurchasePolling } from "@/hooks/usePurchasePolling";
import { mapPurchaseStatusToTracker } from "@/domains/lottery/utils/mapPurchaseStatus";

interface PurchaseStatusResponse {
  status: string;
  sourceChain?: "stacks" | "solana" | "near" | "ethereum" | "base";
  sourceTxId?: string;
  stacksTxId?: string;
  baseTxId?: string;
  error?: string;
  updatedAt?: string | null;
  receipt?: {
    stacksExplorer?: string;
    sourceExplorer?: string;
    baseExplorer?: string | null;
    megapotApp?: string | null;
  };
}

export default function PurchaseStatusPage() {
  const params = useParams();
  const txId = typeof params?.txId === "string" ? params.txId : null;
  const searchParams = useSearchParams();
  const chainParam = searchParams?.get("chain") || undefined;

  const [status, setStatus] = useState<TrackerStatus>("confirmed_source");
  const [data, setData] = useState<PurchaseStatusResponse | null>(null);
  const [sourceChain, setSourceChain] = useState<
    "stacks" | "solana" | "near" | "ethereum" | "base"
  >((chainParam as any) || "stacks");
  const [copied, setCopied] = useState(false);
  const showSolanaAdapterWarning =
    sourceChain === "solana" && !process.env.NEXT_PUBLIC_DEBRIDGE_ADAPTER;

  const sourceExplorerUrl = (() => {
    if (!txId) return undefined;
    switch (sourceChain) {
      case "solana":
        return `https://solscan.io/tx/${txId}`;
      case "near":
        return `https://explorer.near.org/transactions/${txId}`;
      case "stacks":
        return `https://explorer.stacks.co/txid/${txId}?chain=mainnet`;
      case "ethereum":
        return `https://etherscan.io/tx/${txId}`;
      case "base":
        return `https://basescan.org/tx/${txId}`;
      default:
        return undefined;
    }
  })();

  const handleCopyLink = async () => {
    if (!txId) return;
    const url = `${window.location.origin}/purchase-status/${txId}?chain=${sourceChain}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const updateFromResponse = useCallback((response: PurchaseStatusResponse) => {
    setData(response);
    setStatus(mapPurchaseStatusToTracker(response.status));
    if (response.sourceChain) {
      setSourceChain(response.sourceChain);
    }
  }, []);

  useEffect(() => {
    if (!txId) return;
    const fetchInitial = async () => {
      const res = await fetch(`/api/purchase-status/${txId}`);
      if (!res.ok) return;
      const payload = (await res.json()) as PurchaseStatusResponse;
      updateFromResponse(payload);
    };
    fetchInitial();
  }, [txId, updateFromResponse]);

  usePurchasePolling({
    txId,
    currentStatus: status,
    adaptivePolling: true,
    onStatusChange: updateFromResponse,
  });

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
          status={status}
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
              href={`/purchase-status/${txId}?chain=${sourceChain}`}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Share Status Page
            </a>
            <button
              type="button"
              onClick={handleCopyLink}
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
