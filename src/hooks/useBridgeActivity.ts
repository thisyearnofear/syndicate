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
        const run = async () => {
            setIsLoading(true);

            const normalizedAddress = normalizeAddress(address);

            try {
                if (address) {
                    const response = await fetch(`/api/activity?wallet=${encodeURIComponent(address)}&type=bridge`);
                    if (response.ok) {
                        const rows = await response.json();
                        const mapped: BridgeActivityRecord[] = (rows as any[]).map((row) => ({
                            id: row.id,
                            protocol: row.protocol,
                            amount: row.amount,
                            sourceChain: row.sourceChain,
                            destinationChain: row.destinationChain,
                            destinationAddress: row.destinationAddress,
                            sourceAddress: row.sourceAddress ?? undefined,
                            targetStrategy: row.targetStrategy ?? undefined,
                            sourceTxHash: row.txHash ?? undefined,
                            destinationTxHash: row.metadata?.destinationTxHash ?? undefined,
                            bridgeId: row.metadata?.bridgeId ?? undefined,
                            linkedVaultProtocol: row.linkedVaultProtocol ?? undefined,
                            linkedDepositTxHash: row.linkedDepositTxHash ?? undefined,
                            redirectUrl: row.metadata?.redirectUrl ?? undefined,
                            status: row.status,
                            error: row.error ?? undefined,
                            timestamp: row.createdAt,
                            updatedAt: row.updatedAt,
                        }));
                        setActivities(mapped.sort((a, b) => b.updatedAt - a.updatedAt));
                        setPendingBridge(getPendingBridge());
                        setLastUpdated(Date.now());
                        setIsLoading(false);
                        return;
                    }
                }
            } catch (error) {
                console.warn('[useBridgeActivity] Falling back to local activity store:', error);
            }

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
        };

        void run();
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
