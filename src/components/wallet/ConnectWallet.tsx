"use client";

import { useConnect, useAccount, useDisconnect } from "wagmi";
import { useState } from "react";
import DelightfulButton from "@/components/core/DelightfulButton";
import NearWalletConnection from "./NearWalletConnection";
import SolanaWalletConnection from "./SolanaWalletConnection";

export default function ConnectWallet() {
  const { connectors, connect, isPending } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const handleConnect = async (connector: any) => {
    setIsConnecting(true);
    try {
      await connect({ connector });
    } catch (error) {
      console.error("Failed to connect:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Wallet Connected
            </h3>
            <p className="text-gray-300 text-sm">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <DelightfulButton
            onClick={() => disconnect()}
            variant="secondary"
            size="sm"
          >
            Disconnect
          </DelightfulButton>
        </div>

        {/* Advanced Options for Cross-Chain */}
        <div className="mt-6">
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <span className="mr-2">{showAdvancedOptions ? "▼" : "▶"}</span>
            <span>Advanced Options (Cross-Chain)</span>
          </button>

          {showAdvancedOptions && (
            <div className="mt-4 space-y-4">
              <NearWalletConnection />
              <SolanaWalletConnection />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 max-w-md mx-auto">
      <h3 className="text-lg font-semibold text-white mb-3 text-center">
        Connect Wallet
      </h3>

      {/* Primary Wallet Options */}
      <div className="space-y-2 mb-4">
        {connectors.map((connector) => (
          <DelightfulButton
            key={connector.uid}
            onClick={() => handleConnect(connector)}
            disabled={isPending || isConnecting}
            loading={isPending || isConnecting}
            variant="primary"
            className="w-full text-sm py-2"
          >
            {!isPending && !isConnecting && (
              <>
                {connector.name === "MetaMask" && "🦊 "}
                {connector.name === "WalletConnect" && "🔗 "}
                {connector.name === "Coinbase Wallet" && "🔵 "}
                {connector.name}
              </>
            )}
            {(isPending || isConnecting) && "Connecting..."}
          </DelightfulButton>
        ))}
      </div>

      {/* Cross-Chain Options - Collapsible */}
      <details className="mb-3">
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 mb-2">
          ⚡ Cross-Chain Options
        </summary>
        <div className="pl-2 space-y-2">
          <NearWalletConnection />
          <SolanaWalletConnection />
        </div>
      </details>

      {/* Help Text */}
      <div className="text-xs text-gray-500 text-center">
        💡 New to Web3? Try{" "}
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          MetaMask
        </a>
      </div>
    </div>
  );
}
