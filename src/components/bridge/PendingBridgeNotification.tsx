"use client";

/**
 * PENDING BRIDGE NOTIFICATION
 * 
 * Shows notification when user returns with pending bridge
 * Core Principles: CLEAN, MODULAR, ENHANCEMENT FIRST
 * 
 * Reuses existing Toast component
 * Minimal UI - just info and action buttons
 */

import React, { useEffect } from 'react';
import { usePendingBridge } from '@/hooks/usePendingBridge';
import { ExternalLink, X, Clock } from 'lucide-react';

interface PendingBridgeNotificationProps {
    currentBalance?: number;
    onBridgeComplete?: () => void;
}

export function PendingBridgeNotification({
    currentBalance,
    onBridgeComplete
}: PendingBridgeNotificationProps) {
    const { hasPending, protocol, amount, timeRemaining, explorerLink, isOverdue, dismissPending } = usePendingBridge(currentBalance);
    const [isVisible, setIsVisible] = React.useState(false);

    useEffect(() => {
        if (hasPending) {
            setIsVisible(true);
        } else if (isVisible && currentBalance !== undefined) {
            // Bridge completed!
            onBridgeComplete?.();
            setIsVisible(false);
        }
    }, [hasPending, isVisible, currentBalance, onBridgeComplete]);

    if (!isVisible || !hasPending) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-md animate-slide-in-bottom">
            <div className="glass-premium rounded-lg p-4 border border-blue-500/30 shadow-xl">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h4 className="text-white font-semibold mb-1">
                            Bridge in Progress
                        </h4>
                        <p className="text-gray-400 text-sm mb-2">
                            {amount} USDC via {protocol === 'cctp' ? 'CCTP' : 'Wormhole'}
                        </p>
                        <p className="text-gray-500 text-xs mb-3">
                            {isOverdue
                                ? '⏱️ Taking longer than expected - check explorer'
                                : `⏱️ Estimated: ${timeRemaining} remaining`
                            }
                        </p>

                        <div className="flex gap-2">
                            {explorerLink && (
                                <a
                                    href={explorerLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm font-medium"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    View Status
                                </a>
                            )}
                            <button
                                onClick={dismissPending}
                                className="text-gray-400 hover:text-white text-sm font-medium ml-auto"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={dismissPending}
                        className="flex-shrink-0 text-gray-400 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}