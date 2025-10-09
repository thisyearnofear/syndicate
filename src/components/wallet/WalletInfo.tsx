"use client";

import { useWalletConnection } from "@/hooks/useWalletConnection";
import { getWalletStatus } from "@/domains/wallet/services/unifiedWalletService";
import { CHAIN_IDS } from "@/config";

interface WalletInfoProps {
  className?: string;
}

export default function WalletInfo({ className = "" }: WalletInfoProps) {
  const { isConnected, address, walletType, chainId, error } =
    useWalletConnection();

  if (!isConnected || !address) {
    return null;
  }

  const getChainName = (chainId: number | null) => {
    if (!chainId) return "Unknown Network";

    switch (chainId) {
      case CHAIN_IDS.BASE:
        return "Base";
      case CHAIN_IDS.BASE_SEPOLIA:
        return "Base Sepolia";
      case CHAIN_IDS.ETHEREUM:
        return "Ethereum";
      case CHAIN_IDS.AVALANCHE:
        return "Avalanche";
      default:
        return `Network (${chainId})`;
    }
  };

  const getWalletDisplayName = (walletType: string | null) => {
    if (!walletType) return "Wallet";

    switch (walletType) {
      case "metamask":
        return "MetaMask";
      case "phantom":
        return "Phantom";
      case "walletconnect":
        return "WalletConnect";
      case "social":
        return "Social Login";
      case "near":
        return "NEAR Wallet";
      default:
        return walletType;
    }
  };

  const walletStatus = walletType ? getWalletStatus(walletType as any) : null;

  return (
    <div
      className={`bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 ${className}`}
    >
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-green-400">
              Connected
            </span>
          </div>
          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
            {getWalletDisplayName(walletType)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Address</span>
          <span className="text-xs font-mono text-gray-300">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Network</span>
          <span className="text-xs font-medium text-gray-300">
            {getChainName(chainId)}
          </span>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
