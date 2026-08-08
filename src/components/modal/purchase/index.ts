/**
 * Purchase modal sub-components.
 *
 * The SimplePurchaseModal is decomposed into:
 *   - PurchaseProgress: processing/bridging state
 *   - PurchaseReceipt: success state with explorer links + upsells
 *
 * The "select" step remains inline in SimplePurchaseModal due to its
 * tight coupling with chain-specific token selectors and form state.
 * It can be further extracted once the form state is lifted into a
 * dedicated hook.
 */

export { PurchaseProgress } from './PurchaseProgress';
export { PurchaseReceipt } from './PurchaseReceipt';
export { PurchaseErrorBoundary } from './PurchaseErrorBoundary';
