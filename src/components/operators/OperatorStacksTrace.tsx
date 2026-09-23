'use client';

/**
 * OPERATOR STACKS TRACE — Stacks spelling of the shared per-purchase
 * operator audit trail (see OperatorTrace). Kept as a named wrapper for the
 * purchase-status page's Stacks flow.
 */

import { OperatorTrace } from '@/components/operators/OperatorTrace';

export function OperatorStacksTrace({ sourceTxId }: { sourceTxId: string }) {
  return <OperatorTrace source="stacks-keeper" sourceTxId={sourceTxId} />;
}

export default OperatorStacksTrace;
