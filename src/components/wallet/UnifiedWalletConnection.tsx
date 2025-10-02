"use client";

/**
 * UNIFIED WALLET CONNECTION COMPONENT
 * AGGRESSIVE CONSOLIDATION: Single component for all wallet connections
 * DRY: Eliminates duplicate wallet connection logic
 * MODULAR: Reusable across different contexts
 */

import { useState } from "react";
import NearWalletConnection from "./NearWalletConnection";
import SolanaWalletConnection from "./SolanaWalletConnection";
import { Button } from "@/shared/components/ui/Button";

export default function UnifiedWalletConnection() {
  const [selectedWallet, setSelectedWallet] = useState<"near" | "solana" | null>(null);

  const walletOptions = [
    {
      id: "near" as const,
      name: "NEAR",
      icon: "🌌",
      description: "Cross-chain transactions via Chain Signatures",
      component: NearWalletConnection,
    },
    {
      id: "solana" as const,
      name: "Solana",
      icon: "🔥",
      description: "High-speed blockchain with low fees",
      component: SolanaWalletConnection,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Wallet Selection */}
      <div className="grid grid-cols-2 gap-2">
        {walletOptions.map((wallet) => (
          <button
            key={wallet.id}
            onClick={() => setSelectedWallet(wallet.id)}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
              selectedWallet === wallet.id
                ? "bg-blue-600 border-blue-400 text-white"
                : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <span>{wallet.icon}</span>
            <span>{wallet.name}</span>
          </button>
        ))}
      </div>

      {/* Wallet Connection Interface */}
      {selectedWallet && (
        <div className="mt-4">
          {selectedWallet === "near" && <NearWalletConnection />}
          {selectedWallet === "solana" && <SolanaWalletConnection />}
        </div>
      )}

      {/* Quick Connect Buttons */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 text-center mb-2">
          Quick Connect:
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setSelectedWallet("near")}
            variant="secondary"
            size="sm"
            className="flex-1"
          >
            🌌 NEAR
          </Button>
          <Button
            onClick={() => setSelectedWallet("solana")}
            variant="secondary"
            size="sm"
            className="flex-1"
          >
            🔥 Solana
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 text-center">
        💡 Connect additional wallets for cross-chain functionality
      </div>
    </div>
  );
}

// Compact version for inline use
export function CompactWalletConnection() {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="text-xs text-gray-400 hover:text-gray-300 underline"
      >
        + Add Wallet
      </button>
    );
  }

  return (
    <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-700">
      <UnifiedWalletConnection />
      <button
        onClick={() => setIsExpanded(false)}
        className="text-xs text-gray-400 hover:text-gray-300 mt-2"
      >
        ✕ Close
      </button>
    </div>
  );
}