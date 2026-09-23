/**
 * RAIL RECEIPT STATE — pure derivation for the X Layer ticket receipt.
 *
 * The receipt's grammar is: ticket leg (Base purchase) + payment leg
 * (X Layer x402 settlement). Nothing pending may render as complete:
 * only `complete` earns the stamped two-leg receipt; a settled ticket with
 * a failed payment reads as payment-not-collected, never as success.
 */

export type RailReceiptState =
  | 'loading'
  | 'not_found'
  | 'buying'
  | 'ticket_verified_payment_settling'
  | 'payment_not_collected'
  | 'complete'
  | 'failed';

export interface RailStatusJson {
  status?: string;
  paymentSettled?: boolean;
  error?: string | null;
  recipientBaseAddress?: string | null;
  receipt?: {
    sourceExplorer?: string;
    baseExplorer?: string | null;
    megapotApp?: string | null;
  } | null;
}

export interface RailTraceEntry {
  kind?: string;
  label?: string;
}

export const PAYMENT_SETTLE_FAIL_PREFIX = 'Payment settlement failed';

export function deriveRailReceiptState(
  statusJson: RailStatusJson | null | undefined,
  traceEntries: RailTraceEntry[] | null | undefined,
): RailReceiptState {
  if (!statusJson || !statusJson.status) return 'loading';

  const status = statusJson.status;
  if (status === 'not_found') return 'not_found';
  if (status === 'error') return 'failed';

  if (status === 'complete') {
    if (statusJson.paymentSettled) return 'complete';
    const settleFailed = (traceEntries ?? []).some(
      (e) =>
        e.kind === 'fail' &&
        typeof e.label === 'string' &&
        e.label.startsWith(PAYMENT_SETTLE_FAIL_PREFIX),
    );
    return settleFailed ? 'payment_not_collected' : 'ticket_verified_payment_settling';
  }

  // 'settling' and any other in-progress spelling
  return 'buying';
}
