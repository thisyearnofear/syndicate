/**
 * USE PENDING BRIDGE HOOK
 * 
 * Checks for pending bridge on mount and shows notification if completed
 * Core Principles: CLEAN, DRY, PERFORMANT
 * 
 * Only checks once on mount - no polling
 * Reuses existing balance checks
 */

import { useEffect, useState } from 'react';
import {
    getPendingBridge,
    clearPendingBridge,
    hasBridgeCompleted,
    getEstimatedCompletionTime,
    formatTimeRemaining,
    getSolanaExplorerLink
} from '@/utils/bridgeStateManager';

export interface PendingBridgeStatus {
    hasPending: boolean;
    signature?: string;
    protocol?: 'cctp' | 'wormhole';
    amount?: string;
    timeRemaining?: string;
    explorerLink?: string;
    isOverdue?: boolean;
}

export function usePendingBridge(currentBalance?: number) {
    const [status, setStatus] = useState<PendingBridgeStatus>({ hasPending: false });
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
        // Only check once on mount
        if (hasChecked) return;

        const pending = getPendingBridge();
        if (!pending) {
            setHasChecked(true);
            return;
        }

        const timing = getEstimatedCompletionTime(pending);
        const expectedAmount = parseFloat(pending.amount);

        // Check if bridge completed based on balance
        if (currentBalance !== undefined && hasBridgeCompleted(currentBalance, expectedAmount)) {
            // Bridge completed!
            setStatus({
                hasPending: false
            });
            clearPendingBridge();
            setHasChecked(true);
            return;
        }

        // Bridge still pending
        setStatus({
            hasPending: true,
            signature: pending.signature,
            protocol: pending.protocol,
            amount: pending.amount,
            timeRemaining: formatTimeRemaining(timing.remaining),
            explorerLink: getSolanaExplorerLink(pending.signature),
            isOverdue: timing.isOverdue
        });

        setHasChecked(true);
    }, [currentBalance, hasChecked]);

    const dismissPending = () => {
        clearPendingBridge();
        setStatus({ hasPending: false });
    };

    return {
        ...status,
        dismissPending
    };
}
