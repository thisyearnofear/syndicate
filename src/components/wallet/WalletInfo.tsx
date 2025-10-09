"use client";

import { useWalletContext } from "@/context/WalletContext";
import { CHAIN_IDS } from "@/config";
import { Button } from "@/shared/components/ui/Button";

interface WalletInfoProps {
  className?: string;
  showFullAddress?: boolean;
  showNetworkIndicator?: boolean;
}

export default function WalletInfo({
  className = "",
  showFullAddress = false,
  showNetworkIndicator = true,
}: WalletInfoProps) {
  const { state, dispatch } = useWalletContext();

  if (!state.isConnected || !state.address) {
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

  const getChainColor = (chainId: number | null) => {
    if (!chainId) return "gray";

    switch (chainId) {
      case CHAIN_IDS.BASE:
        return "blue";
      case CHAIN_IDS.BASE_SEPOLIA:
        return "purple";
      case CHAIN_IDS.ETHEREUM:
        return "gray";
      case CHAIN_IDS.AVALANCHE:
        return "red";
      default:
        return "gray";
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

  const getWalletIcon = (walletType: string | null) => {
    if (!walletType) return "💼";

    switch (walletType) {
      case "metamask":
        return "🦊";
      case "phantom":
        return "👻";
      case "walletconnect":
        return "🔗";
      case "social":
        return "🔐";
      case "near":
        return "🌌";
      default:
        return "💼";
    }
  };

  const formatAddress = (address: string | null) => {
    if (!address) return "";
    if (showFullAddress) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleDisconnect = () => {
    dispatch({ type: "DISCONNECT" });
  };

  return (
    <div
      className={`bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 ${className}`}
    >
      <div className="flex flex-col space-y-3">
        {/* Wallet and connection status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-green-400">
              Connected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full flex items-center gap-1">
              {getWalletIcon(state.walletType)}{" "}
              {getWalletDisplayName(state.walletType)}
            </span>
            {showNetworkIndicator && (
              <span
                className={`text-xs bg-${getChainColor(
                  state.chainId
                )}-500/20 text-${getChainColor(
                  state.chainId
                )}-300 px-2 py-1 rounded-full`}
              >
                {getChainName(state.chainId)}
              </span>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Address</span>
          <span className="text-xs font-mono text-gray-300">
            {formatAddress(state.address)}
          </span>
        </div>

        {/* Network */}
        {showNetworkIndicator && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Network</span>
            <span className="text-xs font-medium text-gray-300">
              {getChainName(state.chainId)}
            </span>
          </div>
        )}

        {/* Error message */}
        {state.error && (
          <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
            {state.error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="flex-1 text-xs text-gray-400 hover:text-gray-300"
          >
            Disconnect
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: "OPEN_MODAL" })}
            className="flex-1 text-xs text-gray-400 hover:text-gray-300"
          >
            Switch
          </Button>
        </div>
      </div>
    </div>
  );
}
