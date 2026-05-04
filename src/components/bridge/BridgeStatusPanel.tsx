"use client";

import { AlertCircle, CircleCheck, ExternalLink, Loader } from "lucide-react";
import type { SourceChainType } from "@/domains/participation/types";
import { getSourceExplorerName, getSourceExplorerUrl } from "@/domains/participation/utils/getSourceExplorerUrl";
import { getStatusDescription, getStatusMessage } from "@/utils/bridgeStatusMessages";

interface BridgeStatusPanelProps {
  currentStatus: string;
  error?: string | null;
  sourceChain?: SourceChainType;
  txHash?: string | null;
  explorerHref?: string;
  explorerLabel?: string;
  children?: React.ReactNode;
}

export function BridgeStatusPanel({
  currentStatus,
  error,
  sourceChain,
  txHash,
  explorerHref,
  explorerLabel,
  children,
}: BridgeStatusPanelProps) {
  const statusTone = error
    ? "error"
    : currentStatus === "complete"
      ? "complete"
      : "progress";

  const resolvedExplorerHref = explorerHref || getSourceExplorerUrl(sourceChain, txHash);
  const resolvedExplorerLabel =
    explorerLabel || (sourceChain ? `View on ${getSourceExplorerName(sourceChain)}` : "View on Explorer");

  const statusClassName =
    statusTone === "error"
      ? "border-red-500/30 bg-red-500/5"
      : statusTone === "complete"
        ? "border-green-500/30 bg-green-500/5"
        : "border-blue-500/30 bg-blue-500/5";

  return (
    <div className={`glass-premium rounded-lg p-5 border ${statusClassName}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          {statusTone === "error" ? (
            <AlertCircle className="w-6 h-6 text-red-400" />
          ) : statusTone === "complete" ? (
            <CircleCheck className="w-6 h-6 text-green-400" />
          ) : (
            <Loader className="w-6 h-6 animate-spin text-blue-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-lg mb-1">
            {getStatusMessage(currentStatus, error || null)}
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            {getStatusDescription(currentStatus, error || null)}
          </p>

          {children}

          {resolvedExplorerHref && (
            <a
              href={resolvedExplorerHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-blue-400 hover:text-blue-300 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {resolvedExplorerLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

