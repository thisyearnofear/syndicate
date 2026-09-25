"use client";

/**
 * THINKING TRACE — collapsed keeper reasoning (BeautifulUI Thinking).
 *
 * Default closed. Opens to mono detail from agent_run_events. Shared by
 * OperatorTaskRow so /operators, /ways-in, /purchase-status speak one
 * agent language.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function ThinkingTrace({
  detail,
  defaultOpen = false,
  className = "",
}: {
  detail: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={className}>
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
          {detail}
        </p>
      )}
    </div>
  );
}
