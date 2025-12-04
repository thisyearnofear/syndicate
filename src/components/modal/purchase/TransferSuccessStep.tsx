"use client";

import { CompactStack } from "@/shared/components/premium/CompactLayout";
import { ExternalLink, CheckCircle, Clock } from "lucide-react";

interface TransferSuccessStepProps {
  txHash: string;
  amount: string;
  depositAddress: string;
  isBridging?: boolean;
  bridgeProgress?: number; // 0-100
}

export function TransferSuccessStep({
  txHash,
  amount,
  depositAddress,
  isBridging = false,
  bridgeProgress = 0,
}: TransferSuccessStepProps) {
  const shortenHash = (hash: string) => `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  const shortenAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  return (
    <CompactStack spacing="lg" align="center">
      {/* Success Badge */}
      <div className="flex items-center justify-center">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 bg-green-500/20 rounded-full animate-pulse" />
          <div className="absolute inset-2 bg-green-500/10 rounded-full" />
          <CheckCircle className="w-20 h-20 text-green-400 absolute inset-0" />
        </div>
      </div>

      <h2 className="font-bold text-xl md:text-3xl text-white text-center">
        USDC Transfer Sent
      </h2>

      <p className="text-green-300 text-center">
        Successfully sent {amount} USDC to deposit address
      </p>

      {/* Transaction Details Card */}
      <div className="w-full bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-3">
        {/* TX Hash */}
        <div>
          <p className="text-white/60 text-xs font-semibold mb-1">NEAR Transaction</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white/5 rounded px-3 py-2 text-xs text-white/70 font-mono break-all">
              {txHash}
            </code>
            <a
              href={`https://nearblocks.io/txns/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-2 hover:bg-white/10 rounded transition-all"
              title="View on NEAR Explorer"
            >
              <ExternalLink className="w-4 h-4 text-green-400" />
            </a>
          </div>
        </div>

        {/* Deposit Address */}
        <div>
          <p className="text-white/60 text-xs font-semibold mb-1">Deposit Address</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white/5 rounded px-3 py-2 text-xs text-white/70 font-mono">
              {shortenAddress(depositAddress)}
            </code>
            <a
              href={`https://basescan.org/address/${depositAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-2 hover:bg-white/10 rounded transition-all"
              title="View on BaseScan"
            >
              <ExternalLink className="w-4 h-4 text-blue-400" />
            </a>
          </div>
        </div>

        {/* Amount */}
        <div>
          <p className="text-white/60 text-xs font-semibold mb-1">Amount Sent</p>
          <p className="text-lg font-semibold text-white">{amount} USDC</p>
        </div>
      </div>

      {/* Bridge Progress */}
      {isBridging && (
        <div className="w-full space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 animate-spin" />
            <p className="text-amber-300 font-semibold text-sm">
              Bridging in progress...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-xs">Transfer Progress</span>
              <span className="text-white/60 text-xs font-mono">{bridgeProgress}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
                style={{ width: `${Math.min(bridgeProgress, 100)}%` }}
              />
            </div>
          </div>

          <p className="text-white/50 text-xs text-center">
            This typically takes 5-10 minutes. You can close this modal and check back.
          </p>
        </div>
      )}

      {/* Explorer Links Info */}
      <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <p className="text-blue-300 text-xs leading-relaxed">
          <span className="font-semibold">Watch the bridge:</span> Click the explorer icons above to track your transaction progress on NEAR Blocks and BaseScan.
        </p>
      </div>

      {/* Next Steps */}
      <div className="w-full bg-white/5 rounded-lg p-4">
        <p className="text-white/70 text-sm font-semibold mb-2">Next Steps:</p>
        <ol className="text-white/60 text-xs space-y-1">
          <li className="flex gap-2">
            <span className="font-bold text-white/70 flex-shrink-0">1.</span>
            <span>Your USDC is being transferred from NEAR to Base</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white/70 flex-shrink-0">2.</span>
            <span>Once bridged, your ticket purchase will execute automatically</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white/70 flex-shrink-0">3.</span>
            <span>You'll be notified when complete</span>
          </li>
        </ol>
      </div>
    </CompactStack>
  );
}
