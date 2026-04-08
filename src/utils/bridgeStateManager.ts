/**
 * BRIDGE STATE MANAGER
 * 
 * Minimal state management for bridge transactions
 * Core Principles: DRY, CLEAN, PERFORMANT
 * 
 * Stores only essential data (tx signature + metadata)
 * No polling - checks on page load only
 * Reuses existing balance checks
 */

import type { BridgeProtocolType, ChainIdentifier } from '@/services/bridges/types';

export interface PendingBridge {
    signature: string;
    protocol: BridgeProtocolType;
    amount: string;
    recipient: string;
    timestamp: number;
    sourceChain: ChainIdentifier;
    destinationChain: ChainIdentifier;
}

export interface BridgeActivityRecord {
    id: string;
    protocol: BridgeProtocolType;
    amount: string;
    sourceChain: ChainIdentifier;
    destinationChain: ChainIdentifier;
    destinationAddress: string;
    sourceAddress?: string;
    sourceTxHash?: string;
    destinationTxHash?: string;
    bridgeId?: string;
    redirectUrl?: string;
    status: string;
    error?: string;
    timestamp: number;
    updatedAt: number;
}

const STORAGE_KEY = 'pendingBridge';
const HISTORY_KEY = 'bridgeActivityHistory';
const BALANCE_BEFORE_KEY = 'balanceBeforeBridge';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY_ITEMS = 20;

/**
 * Save bridge transaction for later checking
 */
export function savePendingBridge(bridge: PendingBridge): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bridge));
    } catch {
        console.warn('Failed to save pending bridge');
    }
}

/**
 * Save balance before bridge for comparison
 */
export function saveBalanceBeforeBridge(balance: string): void {
    try {
        localStorage.setItem(BALANCE_BEFORE_KEY, balance);
    } catch {
        console.warn('Failed to save balance');
    }
}

/**
 * Get pending bridge if exists and not expired
 */
export function getPendingBridge(): PendingBridge | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const bridge: PendingBridge = JSON.parse(stored);

        // Check if expired (older than 30 minutes)
        const age = Date.now() - bridge.timestamp;
        if (age > MAX_AGE_MS) {
            clearPendingBridge();
            return null;
        }

        return bridge;
    } catch {
        console.warn('Failed to get pending bridge');
        return null;
    }
}

/**
 * Get balance before bridge
 */
export function getBalanceBeforeBridge(): string | null {
    try {
        return localStorage.getItem(BALANCE_BEFORE_KEY);
    } catch {
        return null;
    }
}

/**
 * Clear pending bridge state
 */
export function clearPendingBridge(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(BALANCE_BEFORE_KEY);
    } catch {
        console.warn('Failed to clear pending bridge');
    }
}

function readBridgeHistory(): BridgeActivityRecord[] {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        console.warn('Failed to read bridge activity history');
        return [];
    }
}

function writeBridgeHistory(history: BridgeActivityRecord[]): void {
    try {
        const trimmed = [...history]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {
        console.warn('Failed to write bridge activity history');
    }
}

export function createBridgeActivityId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getBridgeActivityHistory(): BridgeActivityRecord[] {
    return readBridgeHistory();
}

export function upsertBridgeActivity(record: BridgeActivityRecord): void {
    const history = readBridgeHistory();
    const existingIndex = history.findIndex((entry) => entry.id === record.id);

    if (existingIndex >= 0) {
        history[existingIndex] = { ...history[existingIndex], ...record };
    } else {
        history.unshift(record);
    }

    writeBridgeHistory(history);
}

export function updateBridgeActivity(
    id: string,
    updates: Partial<Omit<BridgeActivityRecord, 'id' | 'timestamp'>>
): void {
    const history = readBridgeHistory();
    const existingIndex = history.findIndex((entry) => entry.id === id);
    if (existingIndex === -1) return;

    history[existingIndex] = {
        ...history[existingIndex],
        ...updates,
        updatedAt: Date.now(),
    };

    writeBridgeHistory(history);
}

/**
 * Check if bridge likely completed based on balance increase
 */
export function hasBridgeCompleted(
    currentBalance: number,
    expectedAmount: number
): boolean {
    const balanceBefore = parseFloat(getBalanceBeforeBridge() || '0');
    const increase = currentBalance - balanceBefore;

    // Allow 1% tolerance for rounding
    return increase >= expectedAmount * 0.99;
}

/**
 * Get Solana explorer link for transaction
 */
export function getSolanaExplorerLink(signature: string): string {
    return `https://explorer.solana.com/tx/${signature}`;
}

/**
 * Get estimated completion time for protocol
 */
export function getEstimatedCompletionTime(bridge: PendingBridge): {
    elapsed: number;
    remaining: number;
    total: number;
    isOverdue: boolean;
} {
    const elapsed = Date.now() - bridge.timestamp;
    const total = bridge.protocol === 'cctp' ? 20 * 60 * 1000 : 10 * 60 * 1000; // 20 or 10 minutes
    const remaining = Math.max(0, total - elapsed);
    const isOverdue = elapsed > total;

    return {
        elapsed,
        remaining,
        total,
        isOverdue
    };
}

/**
 * Format time remaining in human-readable format
 */
export function formatTimeRemaining(ms: number): string {
    if (ms <= 0) return 'any moment now';

    const minutes = Math.ceil(ms / 60000);
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
}
