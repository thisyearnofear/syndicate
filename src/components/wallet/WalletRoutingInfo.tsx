"use client";

/**
 * WALLET ROUTING INFO DISPLAY
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for wallet routing display
 * - CLEAN: Clear user-facing explanation of how wallet will be used
 * - MODULAR: Reusable across purchase, bridge, and other flows
 */

import { WalletType, getWalletRouting } from "@/domains/wallet/types";

interface WalletRoutingInfoProps {
  walletType: WalletType;
  compact?: boolean;
  className?: string;
}

export function WalletRoutingInfo({
  walletType,
  compact = false,
  className = "",
}: WalletRoutingInfoProps) {
  const routing = getWalletRouting(walletType);

  if (compact) {
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        {routing.nativeChain} → {routing.destination}
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-3 ${className}`}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Origin Chain</span>
          <span className="text-xs font-medium text-white">{routing.nativeChain}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Bridge Protocol</span>
          <span className="text-xs font-medium text-white">{routing.bridgeProtocol}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Destination</span>
          <span className="text-xs font-medium text-white">{routing.destination}</span>
        </div>
        {!compact && (
          <div className="pt-2 border-t border-blue-500/10">
            <p className="text-xs text-gray-300">{routing.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
