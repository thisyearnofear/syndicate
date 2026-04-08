import { useCallback, useEffect, useState } from 'react';
import { useWalletConnection } from './useWalletConnection';
import {
    getBridgeActivityHistory,
    getPendingBridge,
    type BridgeActivityRecord,
    type PendingBridge,
} from '@/utils/bridgeStateManager';

export interface BridgeActivityState {
    activities: BridgeActivityRecord[];
    pendingBridge: PendingBridge | null;
    isLoading: boolean;
    lastUpdated: number | null;
}

export interface BridgeActivityActions {
    refreshActivity: () => void;
}

function normalizeAddress(value?: string | null) {
    return value?.toLowerCase();
}

export function useBridgeActivity(): BridgeActivityState & BridgeActivityActions {
    const { address } = useWalletConnection();
    const [activities, setActivities] = useState<BridgeActivityRecord[]>([]);
    const [pendingBridge, setPendingBridge] = useState<PendingBridge | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    const refreshActivity = useCallback(() => {
        setIsLoading(true);

        const normalizedAddress = normalizeAddress(address);
        const history = getBridgeActivityHistory()
            .filter((entry) => {
                if (!normalizedAddress) return true;

                return (
                    normalizeAddress(entry.sourceAddress) === normalizedAddress ||
                    normalizeAddress(entry.destinationAddress) === normalizedAddress
                );
            })
            .sort((a, b) => b.updatedAt - a.updatedAt);

        setActivities(history);
        setPendingBridge(getPendingBridge());
        setLastUpdated(Date.now());
        setIsLoading(false);
    }, [address]);

    useEffect(() => {
        refreshActivity();
    }, [refreshActivity]);

    return {
        activities,
        pendingBridge,
        isLoading,
        lastUpdated,
        refreshActivity,
    };
}
