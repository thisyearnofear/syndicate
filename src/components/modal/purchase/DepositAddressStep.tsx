"use client";

import { CompactStack } from "@/shared/components/premium/CompactLayout";
import { useState } from "react";

interface DepositAddressStepProps {
  depositAddress: string;
  amount: string;
  amountUSD?: string;
}

export function DepositAddressStep({
  depositAddress,
  amount,
  amountUSD,
}: DepositAddressStepProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openNearWallet = () => {
    // Try to open NEAR wallet with transfer pre-filled
    const walletUrl = `https://wallet.near.org/?redirect_url=${encodeURIComponent(
      window.location.href
    )}`;
    window.open(walletUrl, "_blank");
  };

  return (
    <CompactStack spacing="lg" align="center">
      {/* ACTION REQUIRED Banner */}
      <div className="w-full bg-amber-500/20 border-2 border-amber-500/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-amber-400 text-xl mt-1">⚠️</div>
          <div className="flex-1">
            <h3 className="text-amber-300 font-bold text-lg mb-1">
              Action Required
            </h3>
            <p className="text-amber-200/80 text-sm leading-relaxed mb-3">
              Your intent has been created. Now you need to send USDC from your NEAR wallet to complete the purchase.
            </p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold text-white/70">STEP 1 OF 3</div>
          <div className="text-xs font-semibold text-white/70">Send USDC</div>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1">
          <div className="bg-amber-500 h-1 rounded-full" style={{ width: "33%" }} />
        </div>
      </div>

      {/* Amount */}
      <div className="w-full bg-white/5 rounded-lg p-4 text-center">
        <p className="text-white/60 text-sm mb-1">Amount to send</p>
        <p className="text-3xl font-bold text-white mb-1">{amount}</p>
        <p className="text-white/40 text-sm">USDC on NEAR</p>
        {amountUSD && (
          <p className="text-white/50 text-sm mt-2">≈ ${amountUSD} USD</p>
        )}
      </div>

      {/* Deposit Address */}
      <div className="w-full">
        <p className="text-white/70 text-sm font-semibold mb-2">Deposit Address</p>
        <div className="bg-white/5 rounded-lg p-4 font-mono text-sm text-white/70 break-all border border-white/10">
          {depositAddress}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full space-y-3">
        <button
          onClick={copyAddress}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
            copied
              ? "bg-green-500/30 text-green-300 border border-green-500/50"
              : "bg-blue-500/20 text-blue-300 border border-blue-500/50 hover:bg-blue-500/30"
          }`}
        >
          {copied ? "✓ Address Copied" : "Copy Address"}
        </button>

        <button
          onClick={openNearWallet}
          className="w-full py-3 bg-amber-500/20 text-amber-300 border border-amber-500/50 rounded-lg font-semibold text-sm hover:bg-amber-500/30 transition-all"
        >
          Open NEAR Wallet
        </button>
      </div>

      {/* Instructions */}
      <div className="w-full bg-white/5 rounded-lg p-4">
        <p className="text-white/70 text-sm font-semibold mb-2">How to send USDC:</p>
        <ol className="text-white/60 text-xs space-y-2">
          <li className="flex gap-2">
            <span className="font-bold text-white/70 flex-shrink-0">1.</span>
            <span>Open your NEAR wallet</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white/70 flex-shrink-0">2.</span>
            <span>Go to Send / Transfer USDC</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white/70 flex-shrink-0">3.</span>
            <span>Paste the deposit address above</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white/70 flex-shrink-0">4.</span>
            <span>Send {amount} USDC</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white/70 flex-shrink-0">5.</span>
            <span>Wait 5-10 minutes for the bridge to complete</span>
          </li>
        </ol>
      </div>

      {/* Info box */}
      <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <p className="text-blue-300/80 text-xs leading-relaxed">
          <span className="font-semibold">What happens next?</span> Once you send the USDC, it will be bridged from NEAR to Base network automatically. Then your ticket purchase will be executed using Chain Signatures - no more action needed from you.
        </p>
      </div>
    </CompactStack>
  );
}
