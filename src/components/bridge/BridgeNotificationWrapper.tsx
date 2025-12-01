"use client";

/**
 * BRIDGE NOTIFICATION WRAPPER
 * 
 * Client-side wrapper for PendingBridgeNotification
 * Integrates with wallet context to get balance
 * Core Principles: CLEAN, MODULAR, ENHANCEMENT FIRST
 */

import React, { useEffect, useState } from 'react';
import { PendingBridgeNotification } from '@/components/bridge/PendingBridgeNotification';
import { useWalletContext } from '@/context/WalletContext';

export function BridgeNotificationWrapper() {
    const { state } = useWalletContext();
    const [baseBalance, setBaseBalance] = useState<number | undefined>(undefined);

    // Fetch Base USDC balance when wallet is connected
    useEffect(() => {
        if (!state.isConnected || !state.address) {
            setBaseBalance(undefined);
            return;
        }

        const fetchBalance = async () => {
            try {
                // Detect if Solana or EVM address
                const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(state.address);
                
                // Build URL - only include chainId for EVM addresses
                let url = `/api/balance?address=${encodeURIComponent(state.address)}`;
                if (!isSolanaAddress) {
                    url += '&chainId=8453'; // Base mainnet for EVM
                }

                // Try GET first (faster), fall back to POST
                let response = await fetch(url);
                
                if (!response.ok && response.status === 405) {
                    // Method Not Allowed - try POST
                    response = await fetch('/api/balance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            address: state.address,
                            chainId: isSolanaAddress ? undefined : 8453 // Base mainnet for EVM only
                        })
                    });
                }

                if (response.ok) {
                    const data = await response.json();
                    // Get USDC/balance field depending on chain
                    const usdcBalance = parseFloat(data.usdc || data.balance || data.solana || data.base || '0');
                    setBaseBalance(usdcBalance);
                } else {
                    console.warn(`[BridgeNotification] Balance fetch failed with status ${response.status}`);
                }
            } catch (error) {
                console.warn('Failed to fetch balance for bridge notification:', error);
            }
        };

        fetchBalance();

        // Refresh balance every 30 seconds to detect completed bridges
        const interval = setInterval(fetchBalance, 30000);
        return () => clearInterval(interval);
    }, [state.isConnected, state.address]);

    // Handle bridge completion
    const handleBridgeComplete = () => {
        console.log('Bridge completed! Refreshing balance...');

        // Trigger a balance refresh
        if (state.isConnected && state.address) {
            setTimeout(() => {
                window.location.reload(); // Simple refresh to update all balances
            }, 1000);
        }
    };

    return (
        <PendingBridgeNotification
            currentBalance={baseBalance}
            onBridgeComplete={handleBridgeComplete}
        />
    );
}
