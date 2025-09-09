"use client";

import { useConnect, useAccount, useDisconnect } from "wagmi";
import { useState } from "react";
import NearWalletConnection from "@/components/wallet/NearWalletConnection";
import SolanaWalletConnection from "@/components/wallet/SolanaWalletConnection";
import DelightfulButton from "@/components/core/DelightfulButton";

export default function ConnectWallet() {
  const { connectors, connect, isPending } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedChain, setSelectedChain] = useState<
    "solana" | "near" | "base" | "avalanche" | null
  >(null);
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

      {/* Chain Selection */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2 text-center">
          Select chain:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "solana", name: "Solana", icon: "🔥" },
            { id: "near", name: "NEAR", icon: "🌐" },
            { id: "base", name: "Base", icon: "🔷" },
            { id: "avalanche", name: "Avalanche", icon: "🏔️" },
          ].map((chain) => (
            <button
              key={chain.id}
              onClick={() => setSelectedChain(chain.id as any)}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs border transition-all ${
                selectedChain === chain.id
                  ? "bg-blue-600 border-blue-400 text-white"
                  : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <span>{chain.icon}</span>
              <span>{chain.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cross-Chain Options - Collapsible */}
      <details className="mb-3">
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 mb-2">
          ⚡ Cross-Chain Options
        </summary>
        <div className="space-y-2 pl-2">
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
