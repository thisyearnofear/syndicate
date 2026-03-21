/**
 * PURCHASE UTILITIES
 *
 * Shared helpers used by all chain handlers.
 * DRY: Single implementation of cross-cutting concerns.
 */

import type { PurchaseChain, PurchaseResult } from "../types/purchase";

// =============================================================================
// PERSISTENCE (localStorage)
// =============================================================================

const STORAGE_KEY = "syndicate_pending_purchase";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function savePendingPurchase(
  bridgeId: string,
  sourceTxHash: string,
  chain: PurchaseChain,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ bridgeId, sourceTxHash, chain, timestamp: Date.now() }),
  );
}

export function getPersistedPurchase(): {
  bridgeId: string;
  sourceTxHash: string;
  chain: PurchaseChain;
  timestamp: number;
} | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < EXPIRY_MS) return parsed;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

export function clearPersistedPurchase(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// =============================================================================
// BRIDGE STATUS PERSISTENCE
// =============================================================================

export interface BridgeStatusPayload {
  sourceTxId: string;
  sourceChain: PurchaseChain;
  status: "bridging" | "complete";
  baseTxId?: string | null;
  bridgeId?: string | null;
  recipientBaseAddress?: string;
}

/**
 * Persist bridge status to the API (best-effort, never throws).
 */
export async function persistBridgeStatus(
  payload: BridgeStatusPayload,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/purchase-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("[purchaseUtils] Failed to persist bridge status:", err);
  }
}

// =============================================================================
// BALANCE CHECK
// =============================================================================

/**
 * Returns an INSUFFICIENT_BALANCE error result, or null if balance is sufficient.
 */
export function checkBalance(
  available: number,
  required: number,
  chain: string,
): PurchaseResult | null {
  if (available < required) {
    return {
      success: false,
      error: {
        code: "INSUFFICIENT_BALANCE",
        message: `Insufficient ${chain} balance. Required: ${required}, Available: ${available}`,
      },
    };
  }
  return null;
}

// =============================================================================
// ERROR HELPERS
// =============================================================================

export function errorResult(
  code: string,
  error: unknown,
  fallback: string,
): PurchaseResult {
  return {
    success: false,
    error: {
      code,
      message: error instanceof Error ? error.message : fallback,
    },
  };
}
