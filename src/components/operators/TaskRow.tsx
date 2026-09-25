/**
 * OPERATOR TASK ROW — agent-native keeper row (BeautifulUI Task Rows translation).
 *
 * Status + collapsed thinking + tool chips + receipt. Renders the
 * OperatorTimelineNode shape from toOperatorTimeline so /operators, /ways-in
 * and /purchase-status share one language. Named OperatorTaskRow to avoid
 * colliding with the Virtuals settings TaskRow.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { OperatorTimelineNode } from "./OperatorRunTimeline";
import { shortHash, timeAgo } from "@/components/proof/ReceiptStrip";

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
      return "completed · on-chain ✓";
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

function toolChips(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s→/-]/g, "")
    .split(/→|\||,|;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export function OperatorTaskRow({
  node,
  explorerTx,
  defaultOpen = false,
}: {
  node: OperatorTimelineNode;
  explorerTx: (hash: string, chain?: string | null) => string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const chips = toolChips(node.label);

  return (
    <li className="relative flex items-start gap-3 pl-1">
      <span aria-hidden className={`mt-1.5 shrink-0 rounded-full ${dotClass(node.kind)}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-medium text-gray-200">{node.label}</p>
          <time
            className="shrink-0 text-[11px] text-gray-500"
            dateTime={new Date(node.at).toISOString()}
          >
            {timeAgo(node.at)}
          </time>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`text-[11px] font-medium ${statusTone(node.kind)}`}>
            {statusLabel(node.kind)}
          </span>
          {chips.length > 1 && (
            <span className="flex flex-wrap items-center gap-1">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-px font-mono text-[10px] text-gray-500"
                >
                  {chip}
                </span>
              ))}
            </span>
          )}
          {node.txHash && (
            <a
              href={explorerTx(node.txHash, node.chain)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-400 underline-offset-2 hover:text-white hover:underline"
            >
              {shortHash(node.txHash)}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>

        {node.detail ? (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-[11px] text-gray-500 transition-colors hover:text-gray-300"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
              {open ? "Hide thinking" : "Show thinking"}
            </button>
            {open && (
              <p className="mt-1 break-words rounded-lg border border-white/[0.07] bg-black/30 p-2.5 font-mono text-[11px] leading-relaxed text-gray-400">
                {node.detail}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}
