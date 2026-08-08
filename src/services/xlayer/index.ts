/**
 * X LAYER PRIZE POOL — Write Service
 *
 * Encapsulates the testnet write flows for the X Layer prize pool:
 *   - joinPool: approve USDC + swap via PrizePoolSwapRouter
 *   - exitPool: withdraw shares (future, when hook supports it)
 *
 * Built on the shared execution state machine and capability registry.
 * Feature-gated: writes only execute when the capability registry reports
 * `xlayer_prize_pool` as write-enabled. Currently set to `false` (read-only)
 * but the code path is fully implemented for testnet use.
 *
 * Integration points:
 *   - Uses the execution state machine for lifecycle tracking
 *   - Emits lifecycle observability events
 *   - Respects the capability registry's write gate
 */

export { useXLayerJoin } from './useXLayerJoin';
export type { XLayerJoinParams, XLayerJoinResult } from './useXLayerJoin';
export { XLAYER_ROUTER_ABI, XLAYER_ERC20_ABI } from './abi';
