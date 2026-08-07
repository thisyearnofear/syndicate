# Prize Pool Hook — X Layer

Uniswap v4 hook that turns swap fees into a lossless lottery on OKX X Layer (chain 196).
Part of the **Build X AI Season** submission — see [docs/BUILD_X_STRATEGY.md](../../docs/BUILD_X_STRATEGY.md).

> The DEX is the lottery. Depositors provide USDC; their share sets their draw odds;
> swap fees accrue to a prize pot; epoch draws award the pot via verifiable randomness;
> principal is redeemable between epochs (exits lock while a draw is open).

## Contracts

| File | Purpose |
|------|---------|
| `PrizePoolHook.sol` | The hook: depositor principal/shares, pot accounting, snapshot-based epoch draws, weighted winner selection, `IRandomnessOracle` fulfillment, `afterSwap` **physically funds the pot** from the router's withheld surcharge, and post-bind configuration timelocks |
| `PrizePoolSwapRouter.sol` | M2 swap wrapper: swaps route through it; the pot surcharge is withheld up front and pulled by the hook during `afterSwap` (USDC input) or parked for M3 conversion (non-USDC input); refunds users on failure |
| `PrizePoolHookFactory.sol` | Atomic CREATE2 hook deployment, router wiring, PoolManager initialization, and ownership transfer |
| `SimpleRandomnessOracle.sol` | TESTNET-ONLY demo oracle (operator sets the accepted value); M4 replaces it with drand verification |
| `interfaces/IRandomnessOracle.sol` | Randomness seam (drand in production, demo/mock in tests) |
| `../../test/PrizePoolHook.t.sol` `../../test/PrizePoolSwapRouter.t.sol` `../../test/PrizePoolHookIntegration.t.sol` `../../test/SimpleRandomnessOracle.t.sol` | Foundry tests (draw machine, weighting, anti-gaming, surcharge funding, router swap/refund flows, real PoolManager integration, and end-to-end swap→pot→draw→claim) |

Dependencies: `lib/v4-core` (Uniswap v4 core, tag `v4.0.0`, added as a git submodule) and
`lib/openzeppelin-contracts` (already in-repo). Imports resolve via
`v4-core/...` (forge auto-remapping of the submodule).

## How a draw works

1. **Deposit** — user deposits USDC (X Layer USDC, 6 decimals). Principal is preserved;
   1 wei = 1 share. Withdrawals are locked while a draw is open (same rule as
   `SyndicatePool`'s post-purchase exit lock) so nobody can exit mid-draw and stay
   eligible for a pot they no longer fund.
2. **Pot** — `fundPot()` is the admin seed path; in M2 the pot **funds itself**: every
   swap through `PrizePoolSwapRouter` withholds `surchargeBps%`, and the hook pulls it
   into `potBalance` during `afterSwap` (USDC-input swaps). Non-USDC surcharges park in
   `router.pendingConversion` until M3 converts them.
3. **`openDraw()`** — anyone (keeper / AI agent) opens an epoch once `potBalance >=
   minPotForDraw` and the cooldown has elapsed. Per-user shares are **frozen into the
   epoch snapshot** — deposits or withdrawals afterwards do not affect this draw (FWA's
   FIFO ordering; the anti-gaming rule).
4. **`fulfillRandomness(value, proof)`** — permissionless; only a value the
   `IRandomnessOracle` accepts is honored. If the oracle is unavailable, anyone can
   call `cancelDraw()` after the one-day timeout to release exit locks. Winner = weighted
   pick over frozen shares.
5. **`claimPrize()`** — winner receives the pot; principal and shares are untouched.

## Randomness (verified Aug 7, 2026)

Chainlink VRF and Pyth Entropy are **not** available on X Layer. The contract is
oracle-agnostic behind `IRandomnessOracle`:

- **Production plan:** a standalone drand (League of Entropy) oracle behind
  `IRandomnessOracle`; a permissionless relayer submits a round, value, and BLS proof,
  and the oracle rejects invalid or reused rounds. The hook contains no crypto math.
- **Current testnet path:** `SimpleRandomnessOracle` is epoch-scoped but operator-controlled;
  it is demo-only and must not secure real-value draws.
- **Tests:** `MockRandomnessOracle` (always valid / configurable).

## Milestone map

- [x] **M1 — draw engine**: deposit/withdraw, pot accounting, snapshots, weighted draw,
      randomness seam, v4 hook shell compiling against real v4-core.
- [x] **M2 — swap wrapper + hardening**: `PrizePoolSwapRouter` withholds the surcharge;
      the hook **physically pulls it during afterSwap**; atomic factory deployment;
      real PoolManager integration coverage; post-bind configuration timelock;
      non-USDC surcharges parked in `pendingConversion`.
- [ ] **M3 — LP position management + fee split**: the hook provides pool liquidity; LP
      fees split into per-depositor yield + pot; convert `pendingConversion` to USDC.
      (Note: the Hooks library skips a hook's own callbacks when the hook initiates the
      action — relevant when the hook LP-splits.)
- [ ] **M4 — standalone drand beacon verifier + permissionless relay** (BLS12-381),
      replacing `SimpleRandomnessOracle` for real-value draws.
- [ ] **M5 — syndicates + AI agent wiring + X Layer wagmi config + dashboard UI.**

## Deployment notes

- **Testnet (195):** no official Uniswap v4 deployment → self-deploy v4 core, then use
  `PrizePoolHookFactory` to atomically deploy the hook, router, and pool.
- **Mainnet (196):** canonical PoolManager
  `0x360e68faccca8ca495c1b759fd9eee466db9fb32` (verified against the official deployment
  registry).
- **Hook permissions (v4.0.0):** the least-significant bits of the hook's deployed
  address encode which callbacks the PoolManager invokes. The deployer must set
  BEFORE_SWAP + AFTER_SWAP (+ AFTER_INITIALIZE) bits per the v4-core `Hooks` library.
- Pool configuration and initialization are performed atomically through
  `PrizePoolHookFactory`, which owns the hook only during setup and transfers ownership
  after the real PoolManager callback binds the pool.
- **USDC:** mainnet `0xB6CEceAB302E2E4948951eE7843FC24E92933061`, testnet
  `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`.

## Security notes (hackathon-grade — harden before mainnet)

- Modulo bias in `computeWinner` — add rejection sampling for production.
- Draw resolution has a one-day timeout and permissionless cancellation; the timeout
  should be timelocked/configured conservatively before real funds.
- Post-bind configuration changes are protected by a two-day owner timelock;
  router replacement has a separate two-day recovery timelock. Deployment-time settings
  are applied by the atomic factory before ownership transfer.
- Exits are locked while a draw is open — deliberate (FWA FIFO + `SyndicatePool`
  precedent), not a bug. Revisit if users demand mid-epoch exits: require the winner to
  hold live shares at resolution instead.
- `fundPot` is a centralized seed path; the pot is now also self-funding from swap
  surcharges (M2). M3 adds the LP-fee split; keep `fundPot` only as a bootstrap/backstop.
- Principal is custodial in the hook for V1 — M3 moves capital into pool liquidity.
