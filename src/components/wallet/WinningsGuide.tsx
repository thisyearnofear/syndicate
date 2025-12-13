"use client";

import { useCrossChainWinnings } from "@/hooks/useCrossChainWinnings";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Loader, AlertCircle } from 'lucide-react';

/**
 * A component that detects if a connected Stacks user has winnings
 * on an associated EVM address and guides them to connect that wallet to claim.
 */
export function WinningsGuide() {
    const { isLoading, error, winningsAmount, associatedEvmAddress } = useCrossChainWinnings();
    const { evmConnected, evmAddress } = useWalletConnection();

    const hasWinnings = parseFloat(winningsAmount) > 0;
    
    // Don't render anything if:
    // - still loading
    // - there's an error
    // - there are no winnings
    // - the associated EVM address is already connected
    if (isLoading || error || !hasWinnings || (evmConnected && evmAddress?.toLowerCase() === associatedEvmAddress?.toLowerCase())) {
        return null;
    }

    if (!associatedEvmAddress) return null;

    return (
        <div className="glass-premium p-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 my-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
                <div>
                    <h4 className="text-lg font-bold text-yellow-400 mb-1">🎉 Congratulations! You Have Winnings on Base!</h4>
                    <p className="text-gray-300">
                        You have <span className="font-bold text-white">${winningsAmount} USDC</span> ready to be claimed.
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                        To claim your winnings, please connect the wallet associated with this address:
                    </p>
                    <div className="font-mono text-xs bg-black/30 text-white rounded px-2 py-1 inline-block mt-2">
                        {associatedEvmAddress}
                    </div>
                </div>
                <div className="flex-shrink-0">
                    <ConnectButton showBalance={false} chainStatus="none" />
                </div>
            </div>
        </div>
    );
}
