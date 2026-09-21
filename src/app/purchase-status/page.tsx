"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CrossChainTracker } from "@/components/bridge/CrossChainTracker";
import { usePurchaseStatusTracker } from "@/domains/participation/hooks/usePurchaseStatusTracker";
import { OperatorStacksTrace } from "@/components/operators/OperatorStacksTrace";
import type { SourceChainType } from "@/domains/participation/types";

const CHAIN_OPTIONS: SourceChainType[] = [
  "stacks",
  "solana",
  "near",
  "starknet",
  "ethereum",
  "base",
];

export default function PurchaseStatusPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txId = searchParams?.get("txId") ?? null;
  const chainParam = (searchParams?.get("chain") as SourceChainType | null) || undefined;

  // Paste-to-trace entry: the /operators surface deep-links here without a
  // tx id, so the page must offer an honest way in — never a fabricated
  // in-progress tracker for a purchase that does not exist.
  const [entryTxId, setEntryTxId] = useState("");
  const [entryChain, setEntryChain] = useState<SourceChainType>(chainParam ?? "stacks");

  const {
    trackerStatus,
    data,
    sourceChain,
    copied,
    sourceExplorerUrl,
    showSolanaAdapterWarning,
    copyShareLink,
  } = usePurchaseStatusTracker(txId, chainParam);

  const submitEntry = () => {
    const trimmed = entryTxId.trim();
    if (!trimmed) return;
    router.push(`/purchase-status?txId=${encodeURIComponent(trimmed)}&chain=${entryChain}`);
  };

  if (!txId) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-white">Purchase Status</h1>
            <p className="text-gray-400 mt-2">
              Paste a transaction id to follow its live progress — and, for
              Stacks purchases, the operator audit trail behind it.
            </p>
          </div>
          <form
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitEntry();
            }}
          >
            <label
              htmlFor="entry-txid"
              className="block text-xs font-mono uppercase tracking-wider text-gray-500"
            >
              Transaction id
            </label>
            <input
              id="entry-txid"
              value={entryTxId}
              onChange={(e) => setEntryTxId(e.target.value)}
              placeholder="0x… or Stacks tx id"
              className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 font-mono text-sm text-white placeholder:text-gray-600 focus:border-white/30 focus:outline-none"
            />
            <div>
              <label
                htmlFor="entry-chain"
                className="mb-1 block text-xs font-mono uppercase tracking-wider text-gray-500"
              >
                Source chain
              </label>
              <select
                id="entry-chain"
                value={entryChain}
                onChange={(e) => setEntryChain(e.target.value as SourceChainType)}
                className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
              >
                {CHAIN_OPTIONS.map((c) => (
                  <option key={c} value={c} className="bg-gray-900">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!entryTxId.trim()}
              className="w-full rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trace this purchase
            </button>
            <p className="text-xs text-gray-500">
              Stacks purchase? The settlement operator&apos;s audit trail — every
              step it took, with on-chain receipts — appears here automatically.
            </p>
          </form>
        </div>
      </div>
    );
  }

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
        {/* Operator trace (Stacks only): the per-purchase keeper audit
            trail, deep-linked from the proof surface. Stacks tx ids are
            recorded normalized; match either spelling for safety. */}
        {sourceChain === "stacks" &&
          txId &&
          (() => {
            const normalized = txId.startsWith("0x") ? txId.slice(2) : txId;
            return (
              <div id="operator-trace" className="scroll-mt-6">
                <OperatorStacksTrace sourceTxId={normalized} />
              </div>
            );
          })()}
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
