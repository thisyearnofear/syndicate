"use client";

import { useWalletContext } from "@/context/WalletContext";
import { CHAIN_IDS } from "@/config";
import { Button } from "@/shared/components/ui/Button";
import { STACKS_WALLETS, getWalletRouting } from "@/domains/wallet/types";
import { WalletRoutingInfo } from "./WalletRoutingInfo";

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
  const { state, disconnectWallet } = useWalletContext();

  if (!state.isConnected || !state.address) {
    return null;
  }

  /**
   * Get chain name and testnet indicator
   * SINGLE SOURCE OF TRUTH for chain naming and testnet detection
   */
  const getChainInfo = (chainId: number | string | null) => {
    if (chainId === null || chainId === undefined) {
      return { name: "Unknown Network", isTestnet: false, badge: "" };
    }

    const numChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;

    const chainMap: Record<number, { name: string; isTestnet: boolean }> = {
      [CHAIN_IDS.BASE]: { name: "Base", isTestnet: false },
      [CHAIN_IDS.BASE_SEPOLIA]: { name: "Base Sepolia", isTestnet: true },
      [CHAIN_IDS.ETHEREUM]: { name: "Ethereum", isTestnet: false },
      [CHAIN_IDS.SEPOLIA]: { name: "Sepolia", isTestnet: true },
      [CHAIN_IDS.AVALANCHE]: { name: "Avalanche", isTestnet: false },
      [CHAIN_IDS.STACKS]: { name: "Stacks", isTestnet: false },
    };

    if (numChainId === 0) {
      // Non-EVM chains
      if (state.walletType === 'stacks') {
        return { name: "Stacks", isTestnet: false, badge: "" };
      }
      const name = state.walletType === 'solana' ? "Solana" : "NEAR";
      return { name, isTestnet: false, badge: "" };
    }

    const info = chainMap[numChainId] || { name: `Network (${numChainId})`, isTestnet: false };
    const badge = info.isTestnet ? "TESTNET" : "";
    
    return { ...info, badge };
  };

  /**
   * Get color based on chain and testnet status
   * TESTNET: Warm warning colors (amber/orange)
   * MAINNET: Standard chain colors
   */
  const getChainColor = (chainId: number | string | null) => {
    if (chainId === null || chainId === undefined) return "gray";

    const numChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
    const { isTestnet } = getChainInfo(numChainId);

    // Testnet always uses warning color
    if (isTestnet) return "amber";

    switch (numChainId) {
      case CHAIN_IDS.BASE:
        return "blue";
      case CHAIN_IDS.ETHEREUM:
        return "gray";
      case CHAIN_IDS.AVALANCHE:
        return "red";
      case 0:
        if (state.walletType === 'stacks') return "orange";
        return state.walletType === 'solana' ? "purple" : "green";
      case 12345:
        return "orange";
      default:
        return "gray";
    }
  };

  const getChainName = (chainId: number | string | null) => {
    return getChainInfo(chainId).name;
  };

  const getWalletDisplayName = (walletType: string | null) => {
     if (!walletType) return "Wallet";

     switch (walletType) {
       case "evm":
         return "EVM Wallet";
       case "solana":
         return "Phantom";
       case "social":
         return "Social Login";
       case "near":
         return "NEAR Wallet";
       case "stacks":
         return "Stacks";
       default:
         return walletType;
     }
   };

   const getWalletIcon = (walletType: string | null) => {
     if (!walletType) return "💼";

     switch (walletType) {
       case "evm":
         return "🔗";
       case "solana":
         return "👻";
       case "social":
         return "🔐";
       case "near":
         return "🌌";
       case "stacks":
         return "₿";
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
    disconnectWallet();
  };

  const routing = state.walletType ? getWalletRouting(state.walletType) : null;

  const chainInfo = getChainInfo(state.chainId);
  const chainColor = getChainColor(state.chainId);
  const isTestnet = chainInfo.isTestnet;

  return (
    <div
      className={`bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border ${
        isTestnet ? 'border-amber-600/50' : 'border-gray-700'
      } ${className}`}
    >
      {/* Testnet warning banner */}
      {isTestnet && (
        <div className="mb-3 bg-amber-500/15 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-amber-400 text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-300">TESTNET MODE</p>
            <p className="text-xs text-amber-200/70">Using test tokens - no real funds</p>
          </div>
        </div>
      )}

      <div className="flex flex-col space-y-3">
        {/* Wallet and connection status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isTestnet ? 'bg-amber-400' : 'bg-green-400'}`} />
            <span className={`text-sm font-semibold ${isTestnet ? 'text-amber-400' : 'text-green-400'}`}>
              {isTestnet ? 'Connected (Testnet)' : 'Connected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full flex items-center gap-1">
              {getWalletIcon(state.walletType)}{" "}
              {getWalletDisplayName(state.walletType)}
            </span>
            {showNetworkIndicator && (
              <span
                className={`text-xs bg-${chainColor}-500/20 text-${chainColor}-300 px-2 py-1 rounded-full flex items-center gap-1 ${
                  isTestnet ? 'font-semibold' : ''
                }`}
              >
                {getChainName(state.chainId)}
                {isTestnet && <span className="ml-1 font-bold">●</span>}
              </span>
            )}
          </div>
        </div>

        {/* Wallet routing info - shows auto bridge routing */}
        {routing && (
          <WalletRoutingInfo
            walletType={state.walletType || 'evm'}
            compact={false}
          />
        )}

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
            className="flex-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            🔌 Disconnect
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // For now, disconnect and let user reconnect with different wallet
              // TODO: Implement proper wallet switching modal
              disconnectWallet();
            }}
            className="flex-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
          >
            🔄 Switch
          </Button>
        </div>
      </div>
    </div>
  );
}
