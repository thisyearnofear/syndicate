"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export function RainbowKitExample() {
  const { isConnected } = useAccount();

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h2 className="text-xl font-bold mb-4">RainbowKit Wallet Connection</h2>

      <div className="mb-4">
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>

      {isConnected && (
        <div className="mt-4 p-3 bg-green-900/30 rounded-lg border border-green-700">
          <p className="text-green-300 text-sm">
            ✅ Wallet connected successfully!
          </p>
        </div>
      )}
    </div>
  );
}
