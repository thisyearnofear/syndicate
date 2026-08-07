# Prize Pool Hook — Technical Spec

The lossless-lottery DEX for OKX X Layer (Build X AI Season). Companion to
[BUILD_X_STRATEGY.md](./BUILD_X_STRATEGY.md) (product/plan) and
[contracts/xlayer/README.md](../contracts/xlayer/README.md) (repo state).

**Status:** M1 + M2 implemented and hardened; the read-only X Layer app slice is also shipped. 104 Foundry tests and 14 focused app tests are green, including real PoolManager integration. M3–M5 and gated write flows remain planned.

---

## 1. Design goals

1. **The DEX is the lottery.** Every swap on the bound pool feeds a prize pot.
2. **Lossless.** Depositor principal is never at risk; only *earnings* (trading fees)
   fund the pot.
3. **Provably fair, anti-gamed.** Weighted selection, snapshot-frozen entries (FIFO),
   verifiable randomness.
4. **Honest money.** No phantom accounting — every pot dollar physically exists.

## 2. Fee capture — why the router withholds (not afterSwap accounting)

Two ways to collect "a slice of every swap for the pot":

| Approach | Problem |
|---|---|
| **afterSwap accounting** — hook records `pot += fee%` and expects tokens later | **Phantom money**: nothing moves during the swap; a display pot grows with no backing. This is exactly the bug class this repo's audits fixed. |
| **Router withholding (chosen)** — swaps route through `PrizePoolSwapRouter`, which pulls the user's input, withholds `surchargeBps%`, swaps only the net, and the hook **physically pulls the withheld tokens during `afterSwap`** | Pot is backed by real tokens at the moment of accrual. |

Flow (exact-in, zeroForOne):

```
user ──approve──▶ PrizePoolSwapRouter.swapExactInput(amountIn)
                    │  pull amountIn from user
                    │  surcharge = amountIn × surchargeBps / 10_000   (0 if disabled)
                    │  netIn = amountIn − surcharge
                    ▼
                  poolManager.lock(callback)
                    │  unlockCallback:
                    │    poolManager.swap(poolKey, exactIn: −netIn, hookData=magic+surcharge)
                    │      └─ PoolManager fires afterSwap(sender=router, ...)
                    │           hook pulls `surcharge` from router → potBalance += surcharge  ◀─ pot funded HERE
                    │    poolManager.sync(input) → transfer netIn → poolManager.settle()
                    │    poolManager.take(output, user, amountOut)
                    ▼
                  user receives output; pot grew by surcharge; pool reserves grew by netIn
```

- **USDC-input swaps** → surcharge lands in `potBalance` immediately (the demo win).
- **Non-USDC-input swaps** (e.g. WOKB) → surcharge is parked in
  `router.pendingConversion` (M3 converts it to USDC). The pot never mixes currencies.
- **Slippage/any revert** → the router refunds the user's full input and bubbles the
  revert (verified: a failed lock rolls back inner state, so the router still holds the
  full input).

Alternative considered: **hook-as-single-LP + LP-fee split** (the hook provides all pool
liquidity; swap fees accrue to its position; it splits into yield + pot). This is M3 —
it's the "yield-to-pot" engine and requires `modifyLiquidity` + fee collection plumbing.
The router approach delivers the demo mechanic now and composes with M3 later.

## 3. Draw economics

- `openDraw()` freezes per-user shares (`epochShares[epoch]`) + `potBalance`
  (`potAtSnapshot`). Deposits/withdrawals after the snapshot affect only the next epoch
  (FWA FIFO; anti-gaming).
- **Exits are locked while a draw is open** (withdraw reverts with `DrawOpen`) — same
  rule as `SyndicatePool`'s post-purchase exit lock. Prevents "deposit → snapshot →
  withdraw → still eligible for a pot you no longer fund."
- Weighted pick: `randomIndex = keccak(seed, beaconValue) % snapshotTotalShares`, walked
  over frozen shares. `seed` binds the beacon value to the exact draw (epoch, snapshot,
  pot, total) so a beacon value can't be replayed across draws.
- Modulo bias is acceptable at demo scale; production hardening adds rejection sampling.
- Strategy knobs (AI agent's job): `minPotForDraw`, `drawCooldown`, `surchargeBps` —
  all owner-set, all timelocked before mainnet.
- Abandoned draws can be cancelled permissionlessly after the configured one-day
  resolution timeout; the pot remains untouched and exit locks are released. Timelock
  this parameter before real funds.

## 4. Randomness (verified: Chainlink VRF / Pyth Entropy are NOT on X Layer)

`IRandomnessOracle` is the seam; the hook never cares how randomness is sourced.

- **M4 (planned):** a standalone drand (League of Entropy) oracle behind
  `IRandomnessOracle`. A permissionless relayer submits `(round, value, BLS signature)`;
  the oracle must verify the signature chain and reject reused rounds before the hook
  accepts the value. The hook deliberately contains no cryptography.
- **Current testnet path:** `SimpleRandomnessOracle` is operator-controlled and
  epoch-scoped. It is explicitly demo-only and must never be used for real-value draws.
- **Tests:** `MockRandomnessOracle`.
- **Fallback (disclosed only):** block-derived values are not a fairness substitute and
  are not enabled by the current deployment script.

## 5. Contract map

| Contract | Role |
|---|---|
| `PrizePoolHook` | Pot + principal, snapshot epochs, weighted draw, randomness fulfillment, `afterSwap` pot funding, and timelocked configuration |
| `PrizePoolHookFactory` | Atomic CREATE2 deployment, pool initialization, router wiring, and ownership transfer |
| `PrizePoolSwapRouter` | Exact-in swap wrapper; withholds surcharge; refunds on revert |
| `IRandomnessOracle` | Randomness seam |
| `MockPoolManager` (test) | Minimal v4 manager emulation (lock/swap/sync/settle/take + hook callbacks) |

## 6. Milestones

- [x] **M1 — draw engine**: deposits, pot, snapshots, weighted draw, oracle seam, hook shell.
- [x] **M2 — swap wrapper + hardening**: router withholding + physical pot funding in
      `afterSwap`, refund-on-failure, non-USDC surcharge parking, atomic factory deployment,
      real PoolManager integration coverage, post-bind configuration timelock, and
      timelocked router recovery.
- [ ] **M3 — LP position management + fee split**: hook provides liquidity; LP fees →
      per-depositor yield + pot. (Note: the Hooks library skips a hook's own callbacks
      when the hook initiates the action — relevant when the hook LP-splits.)
- [x] **M2 hardening — atomic factory deployment + real v4 integration test +
      post-bind configuration timelock.**
- [ ] **M4 — standalone drand oracle + permissionless relay.**
- [ ] **M5 — syndicates + AI agent wiring and gated write flows.** The X Layer wagmi config and read-only `/xlayer` dashboard slice are shipped; see [BUILD_X_APP_INTEGRATION.md](./BUILD_X_APP_INTEGRATION.md).
- [ ] **Harden before mainnet**: rejection sampling, multi-currency conversion sweeps,
      drand verification, and independent review of the oracle cryptography.

## 7. Deploy

See [BUILD_X_DEPLOYMENT.md](./BUILD_X_DEPLOYMENT.md). Highlights:

- Hook deployment, router wiring, configuration, and PoolManager initialization use
  `PrizePoolHookFactory` in one transaction to prevent initialization front-running;
  the factory transfers ownership to the final operator afterward.
- Hook address must carry permission bits (v4.0.0): AFTER_INITIALIZE `0x1000` +
  BEFORE_SWAP `0x80` + AFTER_SWAP `0x40` → **`address & 0x3FFF == 0x10C0`**, found via
  CREATE2 salt search (deploy script included).
- Testnet (195): self-deploy `PoolManager` (permissionless). Mainnet (196): canonical
  `0x360e68faccca8ca495c1b759fd9eee466db9fb32`.
