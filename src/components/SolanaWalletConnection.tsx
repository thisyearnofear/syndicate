"use client";

import {
  useSolanaWallet,
  useSolanaWalletConnection,
} from "@/providers/SolanaWalletProvider";
import { useState, useEffect } from "react";
import { useAddressDisplay } from "@/hooks/useSNS";

export default function SolanaWalletConnection() {
  const { isConnected, publicKey, connect, disconnect, isLoading } =
    useSolanaWalletConnection();
  const { connection } = useSolanaWallet();
  const [isInitializing, setIsInitializing] = useState(false);
  const { displayName, isLoading: isLoadingDomain } = useAddressDisplay(publicKey, connection);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error("Failed to connect Solana wallet:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect Solana wallet:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-400"></div>
          <span className="text-gray-300">Loading Solana wallet...</span>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">
            🔥 Solana Network
          </h3>
          <p className="text-gray-300 mb-4 text-sm">
            Connect your Solana wallet to enable cross-chain ticket purchasing.
          </p>

          <button
            onClick={handleConnect}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Connect Solana Wallet
          </button>

          <div className="mt-4 text-xs text-gray-400">
            <p>Supports: Phantom, Solflare, and other Solana wallets</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            🔥 Solana Connected
          </h3>
          <p className="text-gray-300 text-sm">
            {isLoadingDomain ? (
              <span className="animate-pulse">Loading domain...</span>
            ) : (
              displayName || `${publicKey?.toString().slice(0, 8)}...${publicKey?.toString().slice(-8)}`
            )}
          </p>
          {displayName && displayName.endsWith('.sol') && (
            <div className="flex items-center space-x-1 mt-1">
              <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">SNS</span>
              <span className="text-xs text-purple-300">Verified Domain</span>
            </div>
          )}
        </div>
        <button
          onClick={handleDisconnect}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Solana Network Status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <div>
            <h4 className="font-medium text-white">Network</h4>
            <p className="text-gray-300 text-sm">Mainnet Beta</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span className="text-green-400 text-sm">Connected</span>
          </div>
        </div>

        {/* Supported Chains for Cross-Chain */}
        <div className="p-3 bg-gray-700 rounded-lg">
          <h4 className="font-medium text-white mb-2">Cross-Chain Support</h4>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
              Base
            </span>
            <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">
              Avalanche
            </span>
            <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded">
              Ethereum
            </span>
          </div>
        </div>
      </div>

      {/* Ready for Cross-Chain */}
      <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
        <h4 className="font-medium text-green-200 mb-2">
          ✅ Ready for Cross-Chain
        </h4>
        <p className="text-green-200 text-sm">
          You can now purchase lottery tickets on Base using funds from Solana.
        </p>
      </div>
    </div>
  );
}

// Compact version for use in other components
export function SolanaWalletStatus() {
  const { isConnected, publicKey, connect } = useSolanaWalletConnection();
  const { connection } = useSolanaWallet();
  const { displayName, isLoading: isLoadingDomain } = useAddressDisplay(publicKey, connection);

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors"
      >
        <span>🔥</span>
        <span className="text-sm">Connect Solana</span>
      </button>
    );
  }

  return (
    <div className="flex items-center space-x-2 bg-purple-900/30 border border-purple-700 px-3 py-2 rounded-lg">
      <span>🔥</span>
      <div className="flex flex-col">
        <span className="text-purple-200 text-sm">
          {isLoadingDomain ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            displayName || `${publicKey?.toString().slice(0, 8)}...${publicKey?.toString().slice(-8)}`
          )}
        </span>
        {displayName && displayName.endsWith('.sol') && (
          <span className="text-xs text-purple-400">SNS Domain</span>
        )}
      </div>
    </div>
  );
}