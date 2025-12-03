"use client";

// import {
//   useSolanaWallet,
//   useSolanaWalletConnection,
// } from "@/providers/SolanaWalletProvider";
import { useState } from "react";
// import { useAddressDisplay } from "@/hooks/useSNS";
// import { useSolanaProviderReady } from "@/hooks/useProviderReady";

export default function SolanaWalletConnection() {
  // const isProviderReady = useSolanaProviderReady();
  // const { isConnected, publicKey, connect, disconnect, isLoading } =
  //   useSolanaWalletConnection();
  // const { connection } = useSolanaWallet();
  const [isLoading, setIsLoading] = useState(false);
  // const { displayName, isLoading: isLoadingDomain } = useAddressDisplay(
  //   publicKey,
  //   connection
  // );
  const isProviderReady = true;
  const isConnected = false;
  const displayName: string | null = null;
  const isLoadingDomain = false;

  // Only render the component if provider is ready
  if (!isProviderReady) {
    return (
      <div className="flex items-center space-x-2 text-xs text-gray-400">
        <div className="animate-spin rounded-full h-3 w-3 border-b border-purple-400"></div>
        <span>Loading Solana...</span>
      </div>
    );
  }

  const handleConnect = async () => {
    try {
      // await connect();
      console.log("Solana wallet connection not implemented");
    } catch (error) {
      console.error("Failed to connect Solana wallet:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      // await disconnect();
      console.log("Solana wallet disconnection not implemented");
    } catch (error) {
      console.error("Failed to disconnect Solana wallet:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-xs text-gray-400">
        <div className="animate-spin rounded-full h-3 w-3 border-b border-purple-400"></div>
        <span>Loading Solana...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        className="flex items-center space-x-1 bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs transition-colors"
      >
        <span>🔥</span>
        <span>Solana</span>
      </button>
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
              displayName ||
              "Connected"
            )}
          </p>
          {displayName && false && (
            <div className="flex items-center space-x-1 mt-1">
              <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">
                SNS
              </span>
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
  // const isProviderReady = useSolanaProviderReady();
  // const { isConnected, publicKey, connect } = useSolanaWalletConnection();
  // const { connection } = useSolanaWallet();
  // const { displayName, isLoading: isLoadingDomain } = useAddressDisplay(
  //   publicKey,
  //   connection
  // );
  const isProviderReady = true;
  const isConnected = false;
  const displayName: string | null = null;
  const isLoadingDomain = false;

  // Only render the component if provider is ready
  if (!isProviderReady) {
    return (
      <div className="flex items-center space-x-2 bg-gray-600 text-gray-400 px-3 py-2 rounded-lg">
        <span>🔥</span>
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <button
        onClick={() => console.log("Solana connection not implemented")}
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
            displayName ||
            "Connected"
          )}
        </span>
        {displayName && false && (
          <span className="text-xs text-purple-400">SNS Domain</span>
        )}
      </div>
    </div>
  );
}