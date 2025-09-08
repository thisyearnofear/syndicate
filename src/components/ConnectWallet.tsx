"use client";

import { useConnect, useAccount, useDisconnect } from "wagmi";
import { useState } from "react";
import NearWalletConnection from "@/components/NearWalletConnection";
import SolanaWalletConnection from "@/components/SolanaWalletConnection";
import DelightfulButton from "@/components/DelightfulButton";

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
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">
        Connect Your Wallet
      </h3>
      <p className="text-gray-300 mb-4">
        Choose a wallet to connect and start participating in Syndicate lottery
        pools.
      </p>

      {/* Compact Chain Selector */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-3">
          Select your preferred chain:
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { id: "solana", name: "Solana", icon: "🔥", color: "purple" },
            { id: "near", name: "NEAR", icon: "🌐", color: "blue" },
            { id: "base", name: "Base", icon: "🔷", color: "blue" },
            { id: "avalanche", name: "Avalanche", icon: "🏔️", color: "red" },
          ].map((chain) => (
            <button
              key={chain.id}
              onClick={() => setSelectedChain(chain.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                selectedChain === chain.id
                  ? `bg-${chain.color}-600 border-${chain.color}-400 text-white`
                  : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
              }`}
            >
              <span>{chain.icon}</span>
              <span className="text-sm">{chain.name}</span>
            </button>
          ))}
        </div>
        {selectedChain && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Connecting to{" "}
            {selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1)}{" "}
            network
          </p>
        )}
      </div>

      <div className="space-y-3">
        {connectors.map((connector) => (
          <DelightfulButton
            key={connector.uid}
            onClick={() => handleConnect(connector)}
            disabled={isPending || isConnecting}
            loading={isPending || isConnecting}
            variant="primary"
            className="w-full"
          >
            {!isPending && !isConnecting && (
              <>
                {connector.name === "MetaMask" && "🦊 "}
                {connector.name === "WalletConnect" && "🔗 "}
                {connector.name === "Coinbase Wallet" && "🔵 "}
                Connect with {connector.name}
              </>
            )}
            {(isPending || isConnecting) && "Connecting..."}
          </DelightfulButton>
        ))}
      </div>

      {/* Cross-Chain Wallet Options */}
      <div className="mt-6 space-y-4">
        <div className="border-t border-gray-700 pt-6">
          <h4 className="text-md font-semibold text-white mb-3">
            Cross-Chain Wallets
          </h4>
          <p className="text-gray-400 text-sm mb-4">
            Connect additional wallets for cross-chain lottery purchases.
          </p>

          <div className="space-y-3">
            <NearWalletConnection />
            <SolanaWalletConnection />
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
        <p className="text-blue-200 text-sm">
          💡 <strong>New to Web3?</strong> We recommend starting with{" "}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            MetaMask
          </a>{" "}
          - it's the most popular and user-friendly option.
        </p>
      </div>
    </div>
  );
}
