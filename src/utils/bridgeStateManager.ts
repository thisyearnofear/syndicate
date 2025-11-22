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

export interface PendingBridge {
    signature: string;
    protocol: 'cctp' | 'wormhole';
    amount: string;
    recipient: string;
    timestamp: number;
    sourceChain: 'solana' | 'ethereum';
    destinationChain: 'base';
}

const STORAGE_KEY = 'pendingBridge';
const BALANCE_BEFORE_KEY = 'balanceBeforeBridge';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Save bridge transaction for later checking
 */
export function savePendingBridge(bridge: PendingBridge): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bridge));
    } catch (e) {
        console.warn('Failed to save pending bridge:', e);
    }
}

/**
 * Save balance before bridge for comparison
 */
export function saveBalanceBeforeBridge(balance: string): void {
    try {
        localStorage.setItem(BALANCE_BEFORE_KEY, balance);
    } catch (e) {
        console.warn('Failed to save balance:', e);
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
    } catch (e) {
        console.warn('Failed to get pending bridge:', e);
        return null;
    }
}

/**
 * Get balance before bridge
 */
export function getBalanceBeforeBridge(): string | null {
    try {
        return localStorage.getItem(BALANCE_BEFORE_KEY);
    } catch (e) {
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
    } catch (e) {
        console.warn('Failed to clear pending bridge:', e);
    }
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
