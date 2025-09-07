"use client";

import {
  useNearWallet,
  useNearWalletConnection,
} from "@/providers/NearWalletProvider";
import { useState, useEffect } from "react";
import { getCrossChainTicketService } from "@/services/crossChainTicketService";

export default function NearWalletConnection() {
  const { isConnected, accountId, connect, connectWeb3Auth, disconnect, isLoading, isWeb3Auth } =
    useNearWalletConnection();
  const nearWallet = useNearWallet();
  const [isInitializing, setIsInitializing] = useState(false);
  const [chainSignatureAvailable, setChainSignatureAvailable] = useState(false);

  // Initialize NEAR service when wallet connects
  useEffect(() => {
    if (isConnected && nearWallet && !isInitializing) {
      setIsInitializing(true);

      const initializeService = async () => {
        try {
          // Initialize the cross-chain service with NEAR wallet
          const service = getCrossChainTicketService();
          service.initializeNearService(nearWallet);

          // Check if chain signatures are available
          const nearService = (service as any).nearChainSignatureService;
          if (nearService) {
            const available = await nearService.isChainSignatureAvailable();
            setChainSignatureAvailable(available);
          }

          console.log("NEAR chain signature service initialized");
        } catch (error) {
          console.error("Failed to initialize NEAR service:", error);
        } finally {
          setIsInitializing(false);
        }
      };

      initializeService();
    }
  }, [isConnected, nearWallet, isInitializing]);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error("Failed to connect NEAR wallet:", error);
    }
  };

  const handleWeb3AuthConnect = async () => {
    try {
      await connectWeb3Auth();
    } catch (error) {
      console.error("Failed to connect with Web3Auth:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setChainSignatureAvailable(false);
    } catch (error) {
      console.error("Failed to disconnect NEAR wallet:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-400"></div>
          <span className="text-gray-300">Loading NEAR wallet...</span>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-2">
            🌌 NEAR Protocol
          </h3>
          <p className="text-gray-300 mb-4 text-sm">
            Connect your NEAR wallet to enable cross-chain ticket purchasing
            with chain signatures.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleConnect}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Connect NEAR Wallet
            </button>

            <button
              onClick={handleWeb3AuthConnect}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              🔐 Connect with Web3Auth (Social Login)
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-400">
            <p>Supports: MyNearWallet, Bitte Wallet, Google, Email, etc.</p>
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
            🌌 NEAR Connected {isWeb3Auth ? "(Web3Auth)" : ""}
          </h3>
          <p className="text-gray-300 text-sm">{accountId}</p>
        </div>
        <button
          onClick={handleDisconnect}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Chain Signature Status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <div>
            <h4 className="font-medium text-white">Chain Signatures</h4>
            <p className="text-gray-300 text-sm">
              Cross-chain transaction signing
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {isInitializing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                <span className="text-yellow-400 text-sm">Checking...</span>
              </>
            ) : chainSignatureAvailable ? (
              <>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-green-400 text-sm">Available</span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <span className="text-red-400 text-sm">Unavailable</span>
              </>
            )}
          </div>
        </div>

        {/* MPC Contract Status */}
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <div>
            <h4 className="font-medium text-white">MPC Contract</h4>
            <p className="text-gray-300 text-sm">
              Multi-party computation signing
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
            <span className="text-blue-400 text-sm">Connected</span>
          </div>
        </div>

        {/* Supported Chains */}
        <div className="p-3 bg-gray-700 rounded-lg">
          <h4 className="font-medium text-white mb-2">Supported Chains</h4>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
              Base
            </span>
            <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">
              Avalanche
            </span>
            <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
              Solana
            </span>
            <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded">
              Ethereum
            </span>
          </div>
        </div>
      </div>

      {/* Chain Signature Info */}
      {chainSignatureAvailable && (
        <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
          <h4 className="font-medium text-green-200 mb-2">
            ✅ Ready for Cross-Chain
          </h4>
          <p className="text-green-200 text-sm">
            You can now purchase lottery tickets on Base using funds from
            Avalanche or Solana through NEAR chain signatures.
          </p>
        </div>
      )}

      {/* Warning if chain signatures not available */}
      {!chainSignatureAvailable && !isInitializing && (
        <div className="mt-4 p-4 bg-orange-900/30 border border-orange-700 rounded-lg">
          <h4 className="font-medium text-orange-200 mb-2">
            ⚠️ Chain Signatures Unavailable
          </h4>
          <p className="text-orange-200 text-sm">
            Chain signatures are not available for this account. You may need to
            request access or use a different account.
          </p>
        </div>
      )}
    </div>
  );
}

// Compact version for use in other components
export function NearWalletStatus() {
  const { isConnected, accountId, connect, connectWeb3Auth } = useNearWalletConnection();

  if (!isConnected) {
    return (
      <div className="flex space-x-2">
        <button
          onClick={connect}
          className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors"
        >
          <span>🌌</span>
          <span className="text-sm">Connect NEAR</span>
        </button>
        <button
          onClick={connectWeb3Auth}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
        >
          <span>🔐</span>
          <span className="text-sm">Web3Auth</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 bg-purple-900/30 border border-purple-700 px-3 py-2 rounded-lg">
      <span>🌌</span>
      <span className="text-purple-200 text-sm">
        {accountId?.slice(0, 8)}...{accountId?.slice(-8)}
      </span>
    </div>
  );
}
