"use client";

/**
 * PURCHASE STATUS — the receipt page for every rail.
 *
 * One paste-to-trace form, one live tracker. Stacks and bridge purchases
 * render CrossChainTracker plus the stacks-keeper audit trail; X Layer
 * agent purchases render the two-leg RailReceipt (ticket on Base, payment
 * on X Layer) with the xlayer-rail operator trace. 'xlayer' stays a
 * page-local status choice — it is never passed into the global tracker.
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, PageShell, ShellSection } from "@/components/layout/PageShell";
import { CrossChainTracker } from "@/components/bridge/CrossChainTracker";
import { usePurchaseStatusTracker } from "@/domains/participation/hooks/usePurchaseStatusTracker";
import { OperatorStacksTrace } from "@/components/operators/OperatorStacksTrace";
import { RailReceipt } from "@/components/rail/RailReceipt";
import type { SourceChainType } from "@/domains/participation/types";

type StatusChain = SourceChainType | "xlayer";

const CHAIN_OPTIONS: { value: StatusChain; label: string }[] = [
  { value: "stacks", label: "Stacks" },
  { value: "solana", label: "Solana" },
  { value: "near", label: "NEAR" },
  { value: "starknet", label: "Starknet" },
  { value: "ethereum", label: "Ethereum" },
  { value: "base", label: "Base" },
  { value: "xlayer", label: "X Layer (agent)" },
];

export default function PurchaseStatusPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txId = searchParams?.get("txId") ?? null;
  const chainParam = (searchParams?.get("chain") as StatusChain | null) || undefined;
  const isRail = chainParam === "xlayer";

  // Paste-to-trace entry: the /operators surface deep-links here without a
  // tx id, so the page must offer an honest way in — never a fabricated
  // in-progress tracker for a purchase that does not exist.
  const [entryTxId, setEntryTxId] = useState("");
  const [entryChain, setEntryChain] = useState<StatusChain>(chainParam ?? "stacks");

  // Never hand 'xlayer' to the tracker — it only knows SourceChainType.
  const {
    trackerStatus,
    data,
    sourceChain,
    copied,
    sourceExplorerUrl,
    showSolanaAdapterWarning,
    copyShareLink,
  } = usePurchaseStatusTracker(txId, isRail ? undefined : chainParam);

  // The shared tracker only knows SourceChainType, so for rail rows copy the
  // share link ourselves — otherwise it would emit chain=stacks.
  const [railCopied, setRailCopied] = useState(false);
  const copyRailLink = async () => {
    if (!txId) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/purchase-status?txId=${encodeURIComponent(txId)}&chain=xlayer`,
      );
      setRailCopied(true);
      setTimeout(() => setRailCopied(false), 2000);
    } catch {}
  };

  const submitEntry = () => {
    const trimmed = entryTxId.trim();
    if (!trimmed) return;
    router.push(`/purchase-status?txId=${encodeURIComponent(trimmed)}&chain=${entryChain}`);
  };

  if (!txId) {
    return (
      <PageShell accent="neutral" width="content">
        <PageHeader
          title="Purchase status"
          supportingLine="Paste a transaction id to follow its live progress — and the operator audit trail behind it."
        />
        <ShellSection>
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
              placeholder="0x…, Stacks tx id, or okx-…"
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
                onChange={(e) => setEntryChain(e.target.value as StatusChain)}
                className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
              >
                {CHAIN_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value} className="bg-gray-900">
                    {c.label}
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
              Stacks and agent purchases include the operator&apos;s audit trail —
              every step it took, with on-chain receipts.
            </p>
          </form>
        </ShellSection>
      </PageShell>
    );
  }

  return (
    <PageShell accent="neutral" width="content">
      <PageHeader
        title="Purchase status"
        supportingLine="Tracking your cross-chain purchase. This page will auto-update."
      />
      <ShellSection className="space-y-6">
        <p className="text-xs text-gray-500 font-mono break-all">{txId}</p>

        {isRail ? (
          <RailReceipt txId={txId} />
        ) : (
          <>
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
                trail. Stacks tx ids are recorded normalized; match either
                spelling for safety. */}
            {sourceChain === "stacks" &&
              (() => {
                const normalized = txId.startsWith("0x") ? txId.slice(2) : txId;
                return (
                  <div id="operator-trace" className="scroll-mt-6">
                    <OperatorStacksTrace sourceTxId={normalized} />
                  </div>
                );
              })()}
            {data?.updatedAt && (
              <p className="text-xs text-gray-500">
                Last updated: {new Date(data.updatedAt).toLocaleString()}
              </p>
            )}
            {showSolanaAdapterWarning && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-amber-300 text-sm font-medium">
                  Solana intent adapter not configured
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  Purchases may require an EVM wallet to finalize on Base. Set
                  `NEXT_PUBLIC_DEBRIDGE_ADAPTER` to enable single‑wallet execution.
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-3">
          <a
            href={`/purchase-status?txId=${txId}&chain=${isRail ? "xlayer" : sourceChain}`}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Share Status Page
          </a>
          <button
            type="button"
            onClick={isRail ? copyRailLink : copyShareLink}
            className="text-xs text-gray-300 hover:text-white"
          >
            {(isRail ? railCopied : copied) ? "Copied" : "Copy Link"}
          </button>
        </div>
      </ShellSection>
    </PageShell>
  );
}
