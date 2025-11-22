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
                // Use the new multi-chain balance endpoint
                const response = await fetch('/api/balance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        address: state.address,
                        chainId: 8453 // Base mainnet
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    // Get USDC/balance field depending on chain
                    const usdcBalance = parseFloat(data.usdc || data.balance || '0');
                    setBaseBalance(usdcBalance);
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
