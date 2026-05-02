import { useCallback, useEffect, useState } from 'react';
import { useUnifiedWallet } from './useUnifiedWallet';
import { logger } from '@/lib/logger';
import {
    getVaultActivityHistory,
    type VaultDepositActivityRecord,
} from '@/utils/vaultActivityManager';
import type { VaultProtocol } from '@/services/vaults';

export interface VaultActivityState {
    deposits: VaultDepositActivityRecord[];
    isLoading: boolean;
    lastUpdated: number | null;
}

export interface VaultActivityActions {
    refreshActivity: () => void;
}

function normalizeAddress(value?: string | null) {
    return value?.toLowerCase();
}

export function useVaultActivity(): VaultActivityState & VaultActivityActions {
    const { address } = useUnifiedWallet();
    const [deposits, setDeposits] = useState<VaultDepositActivityRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    const refreshActivity = useCallback(() => {
        const run = async () => {
            setIsLoading(true);

            const normalizedAddress = normalizeAddress(address);

            try {
                if (address) {
                    const response = await fetch(`/api/activity?wallet=${encodeURIComponent(address)}&type=vault_deposit`);
                    if (response.ok) {
                        const rows: Record<string, unknown>[] = await response.json();
                        const mapped: VaultDepositActivityRecord[] = rows.map((row) => ({
                            id: row.id as string,
                            walletAddress: row.walletAddress as string,
                            protocol: row.protocol as VaultProtocol,
                            amount: row.amount as string,
                            txHash: row.txHash as string,
                            timestamp: row.createdAt as number,
                            bridgeActivityId: (row.bridgeActivityId as string) ?? undefined,
                        }));
                        setDeposits(mapped.sort((a, b) => b.timestamp - a.timestamp));
                        setLastUpdated(Date.now());
                        setIsLoading(false);
                        return;
                    }
                }
            } catch (error) {
                logger.warn("Falling back to local activity store", { error: error instanceof Error ? error.message : String(error) });
            }

            const history = getVaultActivityHistory()
                .filter((entry) => {
                    if (!normalizedAddress) return true;
                    return normalizeAddress(entry.walletAddress) === normalizedAddress;
                })
                .sort((a, b) => b.timestamp - a.timestamp);

            setDeposits(history);
            setLastUpdated(Date.now());
            setIsLoading(false);
        };

        void run();
    }, [address]);

    useEffect(() => {
        refreshActivity();
    }, [refreshActivity]);

    return {
        deposits,
        isLoading,
        lastUpdated,
        refreshActivity,
    };
}
