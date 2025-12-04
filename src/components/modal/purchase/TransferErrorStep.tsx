"use client";

import { CompactStack } from "@/shared/components/premium/CompactLayout";
import { AlertCircle, ChevronLeft } from "lucide-react";

interface TransferErrorStepProps {
  error: string;
  depositAddress: string;
  amount: string;
  onRetry: () => void;
  onManualTransfer: () => void;
  isRetrying?: boolean;
}

export function TransferErrorStep({
  error,
  depositAddress,
  amount,
  onRetry,
  onManualTransfer,
  isRetrying = false,
}: TransferErrorStepProps) {
  const shortenAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  return (
    <CompactStack spacing="lg" align="center">
      {/* Error Badge */}
      <div className="flex items-center justify-center">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 bg-red-500/20 rounded-full animate-pulse" />
          <div className="absolute inset-2 bg-red-500/10 rounded-full" />
          <AlertCircle className="w-20 h-20 text-red-400 absolute inset-0" />
        </div>
      </div>

      <h2 className="font-bold text-xl md:text-3xl text-white text-center">
        Transfer Failed
      </h2>

      {/* Error Message */}
      <div className="w-full bg-red-500/20 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-200 text-sm leading-relaxed">
          {error}
        </p>
      </div>

      {/* Transfer Details */}
      <div className="w-full bg-white/5 rounded-lg p-4 space-y-2">
        <div>
          <p className="text-white/60 text-xs font-semibold mb-1">Amount</p>
          <p className="text-white text-sm font-mono">{amount} USDC</p>
        </div>
        <div>
          <p className="text-white/60 text-xs font-semibold mb-1">Recipient</p>
          <p className="text-white text-sm font-mono">{shortenAddress(depositAddress)}</p>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <p className="text-blue-300 text-xs font-semibold mb-2">Troubleshooting:</p>
        <ul className="text-blue-200/80 text-xs space-y-1">
          {error.toLowerCase().includes('insufficient') && (
            <>
              <li>• Make sure you have at least {amount} USDC in your NEAR wallet</li>
              <li>• Check your NEAR account balance</li>
            </>
          )}
          {error.toLowerCase().includes('rejected') && (
            <>
              <li>• You cancelled the transaction in your wallet</li>
              <li>• Approve the transaction when prompted again</li>
            </>
          )}
          {error.toLowerCase().includes('timeout') && (
            <>
              <li>• The request took too long to complete</li>
              <li>• Try again - your network may be slow</li>
            </>
          )}
          {!error.toLowerCase().includes('insufficient') &&
            !error.toLowerCase().includes('rejected') &&
            !error.toLowerCase().includes('timeout') && (
              <>
                <li>• Check your internet connection</li>
                <li>• Try again in a moment</li>
              </>
            )}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="w-full space-y-3">
        {/* Retry Button */}
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
            isRetrying
              ? "bg-amber-500/30 text-amber-300 border border-amber-500/50 cursor-wait"
              : "bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30"
          }`}
        >
          {isRetrying ? "Retrying..." : "Try Again"}
        </button>

        {/* Manual Transfer Fallback */}
        <button
          onClick={onManualTransfer}
          disabled={isRetrying}
          className="w-full py-3 bg-white/10 text-white/70 border border-white/20 rounded-lg font-semibold text-sm hover:bg-white/20 disabled:opacity-50 transition-all"
        >
          Send Manually Instead
        </button>
      </div>

      {/* Info */}
      <div className="w-full bg-white/5 rounded-lg p-3">
        <p className="text-white/50 text-xs leading-relaxed">
          If the issue persists, you can send USDC manually from your NEAR wallet to the deposit address above.
        </p>
      </div>
    </CompactStack>
  );
}
