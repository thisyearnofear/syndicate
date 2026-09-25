/**
 * OPERATOR TASK ROW — agent-native keeper row (BeautifulUI Task Rows).
 *
 * Status + ThinkingTrace + tool chips + ReceiptStrip. Renders the
 * OperatorTimelineNode shape from toOperatorTimeline so /operators,
 * /ways-in and /purchase-status share one language.
 */

"use client";

import type { OperatorTimelineNode } from "./OperatorRunTimeline";
import { ReceiptStrip } from "@/components/proof/ReceiptStrip";
import { ThinkingTrace } from "@/components/agent/ThinkingTrace";

function statusTone(kind: OperatorTimelineNode["kind"]): string {
  switch (kind) {
    case "complete":
      return "text-emerald-400";
    case "fail":
    case "plan_failed":
      return "text-rose-400";
    default:
      return "text-gray-500";
  }
}

function statusLabel(kind: OperatorTimelineNode["kind"]): string {
  switch (kind) {
    case "complete":
      return "completed";
    case "fail":
      return "failed";
    case "plan_failed":
      return "plan failed";
    default:
      return "running";
  }
}

function dotClass(kind: OperatorTimelineNode["kind"]): string {
  switch (kind) {
    case "complete":
      return "bg-emerald-400 w-3.5 h-3.5";
    case "fail":
    case "plan_failed":
      return "bg-rose-400 w-2.5 h-2.5";
    default:
      return "bg-slate-400 w-2.5 h-2.5 animate-pulse";
  }
}

function toolChips(node: OperatorTimelineNode): string[] {
  const chips = node.toolId ? [node.toolId] : [];
  if (chips.length > 0) return chips;
  return node.label
    .toLowerCase()
    .replace(/[^a-z0-9\s→/-]/g, "")
    .split(/→|\||,|;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function receiptStatus(
  kind: OperatorTimelineNode["kind"],
): "verified" | "pending" | "absorbed" {
  if (kind === "complete") return "verified";
  if (kind === "fail" || kind === "plan_failed") return "absorbed";
  return "pending";
}

export function OperatorTaskRow({
  node,
  explorerTx,
  defaultOpen = false,
  now,
}: {
  node: OperatorTimelineNode;
  explorerTx: (hash: string, chain?: string | null) => string;
  defaultOpen?: boolean;
  /** Wall clock from the timeline; enables live elapsed on in-flight rows. */
  now?: number;
}) {
  const chips = toolChips(node);
  const elapsed =
    node.kind === "plan" && now !== undefined
      ? `${Math.max(0, Math.floor((now - node.at) / 1000))}s`
      : null;

  return (
    <li className="relative flex items-start gap-3 pl-1">
      <span aria-hidden className={`mt-1.5 shrink-0 rounded-full ${dotClass(node.kind)}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-medium text-gray-200">{node.label}</p>
          <span className={`shrink-0 text-[11px] font-medium tabular-nums ${statusTone(node.kind)}`}>
            {statusLabel(node.kind)}
            {elapsed ? ` · ${elapsed}` : ""}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {chips.length > 1 &&
            chips.map((chip) => (
              <span
                key={chip}
                className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-px font-mono text-[10px] text-gray-500"
              >
                {chip}
              </span>
            ))}
        </div>

        {node.txHash ? (
          <div className="mt-1.5">
            <ReceiptStrip
              label="receipt"
              txHash={node.txHash}
              explorerUrl={explorerTx(node.txHash, node.chain)}
              at={node.at}
              status={receiptStatus(node.kind)}
              compact
            />
          </div>
        ) : (
          <div className="mt-1">
            <ReceiptStrip
              label={node.kind === "plan" ? "in flight" : "no receipt"}
              at={node.at}
              status={receiptStatus(node.kind)}
              compact
            />
          </div>
        )}

        {node.detail ? (
          <ThinkingTrace detail={node.detail} defaultOpen={defaultOpen} className="mt-1" />
        ) : null}
      </div>
    </li>
  );
}
