/**
 * BRIDGE STATUS MESSAGES
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for bridge status messages
 * - CONSOLIDATION: Extracted from FocusedBridgeFlow and InlineBridgeFlow
 */

export function getStatusMessage(status: string, error: string | null): string {
  if (error) return 'Bridge Failed';
  if (status === 'complete') return 'Bridge Complete!';
  if (status === 'confirming') return 'Confirming Transaction';
  if (status === 'bridging') return 'Bridging in Progress';
  if (status === 'waiting_destination') return 'Waiting for Destination';
  if (status === 'finalizing') return 'Finalizing Bridge';
  return 'Processing';
}

export function getStatusDescription(status: string, error: string | null): string {
  if (error) return error;
  if (status === 'complete') return 'Your USDC has been successfully bridged to Base Network';
  if (status === 'confirming') return 'Waiting for transaction confirmation on source chain';
  if (status === 'bridging') return 'Your funds are being transferred across chains';
  if (status === 'waiting_destination') return 'Waiting for destination chain to receive funds';
  if (status === 'finalizing') return 'Completing the bridge transaction';
  return 'Your bridge transaction is being processed';
}

export function getProgressFromStatus(status: string): number {
  const progressMap: Record<string, number> = {
    'confirming': 20,
    'bridging': 50,
    'waiting_destination': 70,
    'finalizing': 90,
    'complete': 100,
  };
  return progressMap[status] || 10;
}
