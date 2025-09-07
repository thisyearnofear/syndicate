"use client";

import { useConnect, useAccount, useDisconnect } from "wagmi";
import { useState } from "react";
import NearWalletConnection from "@/components/NearWalletConnection";
import SolanaWalletConnection from "@/components/SolanaWalletConnection";

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
            <h3 className="text-lg font-semibold text-white mb-2">Wallet Connected</h3>
            <p className="text-gray-300 text-sm">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <button
            onClick={() => disconnect()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Disconnect
          </button>
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
      <h3 className="text-lg font-semibold text-white mb-4">Connect Your Wallet</h3>
      <p className="text-gray-300 mb-6">
        Choose a wallet to connect and start participating in Syndicate lottery pools.
      </p>
      
      <div className="space-y-3">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => handleConnect(connector)}
            disabled={isPending || isConnecting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            {isPending || isConnecting ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Connecting...
              </div>
            ) : (
              <>
                {connector.name === "MetaMask" && "🦊 "}
                {connector.name === "WalletConnect" && "🔗 "}
                {connector.name === "Coinbase Wallet" && "🔵 "}
                Connect with {connector.name}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Cross-Chain Wallet Options */}
      <div className="mt-6 space-y-4">
        <div className="border-t border-gray-700 pt-6">
          <h4 className="text-md font-semibold text-white mb-3">Cross-Chain Wallets</h4>
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
