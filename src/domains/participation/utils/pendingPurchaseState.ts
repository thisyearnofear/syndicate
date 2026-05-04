import type { SourceChainType } from '@/domains/participation/types';

const PENDING_PURCHASE_KEY = 'pending_cross_chain_purchase';
const MAX_PENDING_PURCHASE_AGE_MS = 60 * 60 * 1000;

export interface PendingPurchaseState {
  sourceTxHash: string;
  chain: SourceChainType;
  bridgeId?: string;
  ticketCount?: number;
  timestamp: number;
}

export function savePendingPurchaseState(state: PendingPurchaseState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(state));
  } catch {}
}

export function getPendingPurchaseState(): PendingPurchaseState | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(PENDING_PURCHASE_KEY);
    if (!saved) return null;

    const pending = JSON.parse(saved) as PendingPurchaseState;
    if (Date.now() - pending.timestamp > MAX_PENDING_PURCHASE_AGE_MS) {
      clearPendingPurchaseState();
      return null;
    }

    return pending;
  } catch {
    clearPendingPurchaseState();
    return null;
  }
}

export function clearPendingPurchaseState(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(PENDING_PURCHASE_KEY);
  } catch {}
}

