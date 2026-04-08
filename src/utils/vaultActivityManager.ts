import type { VaultProtocol } from '@/services/vaults';

export interface VaultDepositActivityRecord {
    id: string;
    walletAddress: string;
    protocol: VaultProtocol;
    amount: string;
    txHash: string;
    timestamp: number;
    bridgeActivityId?: string;
}

const STORAGE_KEY = 'vaultDepositActivityHistory';
const MAX_HISTORY_ITEMS = 30;

function readVaultActivityHistory(): VaultDepositActivityRecord[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        console.warn('Failed to read vault activity history');
        return [];
    }
}

function writeVaultActivityHistory(history: VaultDepositActivityRecord[]): void {
    try {
        const trimmed = [...history]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
        console.warn('Failed to write vault activity history');
    }
}

export function createVaultActivityId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `vault-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getVaultActivityHistory(): VaultDepositActivityRecord[] {
    return readVaultActivityHistory();
}

export function recordVaultDepositActivity(record: VaultDepositActivityRecord): void {
    const history = readVaultActivityHistory();
    history.unshift(record);
    writeVaultActivityHistory(history);
}
