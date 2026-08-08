# Build X AI Season Strategy (X Layer)

**Project**: Syndicate — "Prize Pool Hook" (lossless lottery DEX on X Layer)
**Track**: OKX X Layer Build X — AI Season (AI + onchain value)
**Status**: Active execution plan; M2 hardened and read-only app slice shipped
**Window**: Aug 7 → Aug 21, 2026 (submission Aug 21, 23:59 UTC)
**Last Updated**: Aug 8, 2026

## TL;DR — one product, two engines

Syndicate already lets users buy lottery tickets "for free": park capital in yield vaults on
Base, and only the *interest* buys Megapot tickets. Principal preserved.

Build X is the same product soul on a **new engine**: a Uniswap v4 hook on X Layer whose
**trading fees fund the prize pot**. Depositors provide liquidity; their share sets their
draw odds (FWA-style weighted selection); swap fees split into LP yield + a prize pot; epoch
draws award the pot via verifiable randomness; principal is always withdrawable. The existing
AI layer — Venice policy advisor + permissioned autopilot — is the strategy brain: it reviews
the pot vs. expected value, recommends the fee split and draw cadence, and triggers draws
within user-approved, revocable caps.

**Novelty claim (honest + checkable):** we intend to be the first custom Uniswap v4 hook
on X Layer to turn the DEX itself into the lottery. This is a proposed ecosystem claim to
verify after testnet deployment; no project on X Layer is currently known to use custom v4
hooks in production.

## Why this concept

- **AI Season requirement:** AI elements are mandatory. We already have a real agentic layer
  (Venice advisor → capped, revocable execution → activity log). It satisfies the requirement
  with production code, not a demo wrapper.
- **FWA validation:** [FWA](https://www.fwa.fun/docs/overview) proved randomized
  acquisition pools work onchain: depositor backing sets selection weight, VRF supplies
  randomness, FIFO settlement prevents queue-jumping, and a guaranteed exit path (standing
  bid / redeem) preserves depositor confidence. We port those principles to the lossless
  lottery domain where Syndicate has actual expertise.
- **What FWA does NOT validate:** v4 hooks. FWA is a standalone pair-style contract
  ("similar to a Uniswap V2 pair"). Housing the mechanics inside Uniswap v4 hooks on X Layer
  is **our** novel twist — pitch it as such, not as FWA precedent.
- **Ecosystem contribution (judging criterion):** X Layer is young; a hook that makes LPs
  earn lottery entries is a plausible liquidity magnet for its DEX ecosystem.

### FWA game theory — what transfers, what doesn't

| Transfers to the hook | Does not transfer |
|---|---|
| Weighted randomness (share = odds) | NFT/backing arbitrage (purchasers paying pool-derived price for possibly-underpriced unique assets). A USDC pool has no unique asset. |
| Asymmetric upside (small depositor can win a pot far larger than their stake, funded by others' trading) | |
| Keep-or-exit (redeem principal between epochs; exits lock while a draw is open — FWA FIFO + `SyndicatePool` precedent) | |
| FIFO / snapshot anti-gaming (deposits after the snapshot only count for the next draw) | |

We are a lottery product, not an NFT marketplace — the dropped mechanic is fine and should
be stated honestly in the submission.

## Verified facts (as of Aug 7, 2026)

### Build X AI Season — participation requirements

| Requirement | Status |
|---|---|
| AI elements in product design + deployed on X Layer | ✅ AI layer exists; hook is deployment-ready, X Layer deployment pending |
| Deployed on **X Layer Testnet** during the hackathon, then launched on **X Layer Mainnet** | Planned (testnet self-deployed v4 core; mainnet canonical PoolManager) |
| Dedicated X account, active; submission post must mention @XLayerOfficial | TODO |
| Google Form submission by **Aug 21, 2026 23:59 UTC** | TODO |

### Prizes

| Award | Amount | Note |
|---|---|---|
| Hackathon Grant | 1st 30,000 / 2nd 15,000 / 3rd 5,000 USDT | Main AI Season pool (up to 300k total) |
| Liquidity Grant | 50,000 USDT | Best project in the **AI-RWA track** — see §AI-RWA positioning |
| Launch Grant | up to 200,000 USDT | Needs 10M USDT cumulative volume via OKX DEX by Aug 31 — **not realistic for this window; do not build for it** |

### X Layer network facts

| Item | Mainnet (196) | Testnet (195) |
|---|---|---|
| RPC | `https://rpc.xlayer.tech` / `https://xlayerrpc.okx.com` | `https://testrpc.xlayer.tech/terigon` / `https://xlayertestrpc.okx.com/terigon` |
| Gas | OKB | OKB |
| USDC | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` | `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3` |
| Explorer | okx.com/web3/explorer/xlayer / OKLink | okx.com/web3/explorer/xlayer-test / OKLink |

### Uniswap v4 on X Layer

- ✅ **Mainnet deployed (canonical):** PoolManager `0x360e68faccca8ca495c1b759fd9eee466db9fb32`,
  PositionManager `0xcf1eafc6928dc385a342e7c6491d371d2871458b`. Confirmed against the official
  Uniswap v4 deployment registry.
- ⚠️ **Testnet: no official deployment** → self-deploy v4 core + periphery on testnet
  (v4 core is permissionless to deploy; standard practice for testnet demos). ~1 day.

### Randomness on X Layer — the critical finding

| Source | Available? |
|---|---|
| Chainlink VRF (v2/v2.5) | ❌ **No** — not on the official supported-networks list; only CCIP + Data Feeds are live on X Layer |
| Pyth Entropy | ❌ No |
| Gelato VRF | ❌ No (Gelato Automation/Web3 Functions: yes — usable as keeper infra) |
| **drand beacon + relayer** | ✅ Buildable — public League-of-Entropy beacon; verifiable onchain (anyone can verify, relayer can censor but cannot bias). **Recommended.** |
| prevrandao / blockhash | ❌ Not used for draws — not provably fair |

**Decision (Gate 1):** wire randomness behind a clean seam (`IRandomnessOracle`) so the
contract is oracle-agnostic; keep the operator-controlled oracle only for the disclosed
testnet demo; ship a separately reviewed drand oracle + permissionless relay before any
real-value draw.

## Two-lane architecture

| | **Base — existing product (unchanged)** | **X Layer — Prize Pool Hook (new)** |
|---|---|---|
| Lottery engine | Megapot (real draw, tickets) | Hook's own epoch draw (weighted by pool share) |
| What funds tickets/prizes | Yield from lending vaults (Spark/Aave/…) | Trading fees from the v4 pool (surcharge + LP fee split) |
| User capital | Yield vault | Pool liquidity (via hook) |
| Principal preserved | ✅ | ✅ |
| Chain | Base 8453 | X Layer 196 |

**Shared layer (the abstraction):** same app shell and "play for free forever" narrative; same
AI advisor + permissioned autopilot (capped, revocable agent policies); same syndicate
mechanics (shared pool, proportional winnings split — with Fhenix privacy as an option);
same "keep your money, win the pot" promise.

## Contract architecture (in repo)

- `contracts/xlayer/PrizePoolHook.sol` — Uniswap v4 hook (v4.0.0 interfaces from
  `lib/v4-core`): depositor principal/shares, pot accounting, snapshot-based epoch draws,
  weighted winner selection, `IRandomnessOracle` fulfillment.
- `contracts/xlayer/PrizePoolSwapRouter.sol` — M2 swap wrapper: swaps route through it;
  the pot surcharge is withheld up front and **physically pulled by the hook during
  `afterSwap`** (USDC input) or parked for M3 conversion (non-USDC input); refunds on
  failure. The pot funds itself from real trades — no phantom money.
- `contracts/xlayer/SimpleRandomnessOracle.sol` — TESTNET-ONLY demo oracle; M4 replaces it
  with drand verification.
- `contracts/xlayer/interfaces/IRandomnessOracle.sol` — randomness seam.
- `script/DeployPrizePoolHook.s.sol` + `script/DeployV4CoreXLayer.s.sol` — deploy scripts
  (CREATE2 salt search for the hook's permission-bits address).
- `test/` — 104 Foundry tests, including real PoolManager integration, draw mechanics,
  surcharge funding, router swap/refund flows, and end-to-end swap→pot→draw→claim.
- See `contracts/xlayer/README.md` + `docs/BUILD_X_HOOK_SPEC.md` + `docs/BUILD_X_DEPLOYMENT.md`.
- The app-side read-only slice is now live in the repo at `/xlayer`: chain 195 is registered with wagmi, deployment-aware reads expose pot/shares/draw settings/user odds, and missing or malformed addresses produce a safe preview state. See [BUILD_X_APP_INTEGRATION.md](./BUILD_X_APP_INTEGRATION.md).

### Milestones

1. ✅ **M1** — draw engine + pot + principal preservation + hook shell + tests.
2. ✅ **M2** — swap wrapper: the pot is self-funding from real trades.
3. **M3** — LP position management + fee split (yield-to-pot engine) + non-USDC conversion.
4. **M4** — drand beacon verifier + permissionless relay (BLS12-381).
5. **M5** — In progress: read-only X Layer wagmi config + dashboard UI shipped; syndicates, AI agent wiring, and gated write flows remain.

## 14-day execution plan

- **Days 1–2 — Gate 1 (no-go if red):** lock the drand production path; verify v4 core
  self-deploys on X Layer testnet; create X account; register intent; finalize hook design
  (repo state: M1+M2 plus hardening done, 104 tests green).
- **Days 3–7:** deploy to X Layer testnet with self-deployed v4 core; one live pool with
  the hook + router; live swaps funding the pot (M2 already makes this work end-to-end).
- **Days 8–10:** drand relay; AI agent wiring (advisor reads pot/odds/fee, recommends
  settings, agent triggers draws as keeper within caps); extend the shipped read-only
  dashboard with explicitly gated testnet write flows.
- **Days 11–12:** live testnet demo: real swaps → pot growth → draw → winner claim; record
  60–90s demo video.
- **Days 13–14:** **mainnet launch** against canonical PoolManager (rule requires it); X post
  mentioning @XLayerOfficial; Google Form submission; AI-RWA paragraph for the Liquidity
  Grant.

## AI-RWA positioning (50k Liquidity Grant)

The AI-RWA track rewards projects combining AI with real-world assets. Our honest angle:
vault yield from real lending/treasuries (Spark sUSDC, Aave) funds lottery participation —
"real-world yield meets prize savings." The X Layer hook makes that yield the pot's fuel.
One paragraph in the submission, no extra build.

## Submission checklist

- [ ] AI elements + X Layer deployment (hook + AI agent)
- [ ] X Layer Testnet deployment (during hackathon)
- [ ] X Layer Mainnet launch
- [ ] Dedicated X account + submission post mentioning @XLayerOfficial
- [ ] Google Form by Aug 21, 2026 23:59 UTC
- [ ] 60–90s demo video (what, why, how, live onchain activity)
- [ ] 1-pager + contract repo + deployed addresses
- [ ] AI-RWA track paragraph (Liquidity Grant)

## Go/No-Go gates

- **Gate 1 (end of day 2):** is the drand path credibly solvable and the v4 core deployable
  on X Layer testnet? If either fails, fall back to an X Layer deployment of the existing
  product + AI layer (compliant, lower novelty) or skip. No operator-controlled randomness
  fallback is permitted for real-value draws.
- **Gate 2 (end of day 7):** hook + one live testnet pool with real swaps and a completed
  draw. If not, cut scope (simplify to pot + draw, no surcharge) rather than slip.

## References

- Build X AI Season: https://web3.okx.com/xlayer/build-x-series
- FWA overview: https://www.fwa.fun/docs/overview
- Chainlink VRF supported networks: https://docs.chain.link/vrf/v2-5/supported-networks
- Uniswap v4 deployments (X Layer PoolManager `0x360e68faccca8ca495c1b759fd9eee466db9fb32`)
- v4-core source in-repo: `lib/v4-core` (tag v4.0.0)
- Prior hackathon strategy docs: `docs/HACKATHON.md`, `docs/RANGER_HACKATHON_STRATEGY.md`
