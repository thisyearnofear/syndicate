# X Layer Prize Pool Hook

**Status:** Testnet deployed on X Layer chain **1952** (Build X AI Season entry, closes 2026-08-21). `/xlayer` leads with a guided stranger walkthrough (connect → switch → faucet → shares → agent) plus the agent loop (deposit / swap join / fundPot / HITL draw) when `NEXT_PUBLIC_XLAYER_WRITES_ENABLED=true`. A scheduled operator keeper (daily cron, full-epoch chaining per tick) keeps the pool alive between visitors and persists every transition server-side; the page replays the latest operator run publicly (no wallet needed). Mainnet randomness path **designed** (drand + permissionless relay with bonded-relay fallback — see Randomness decision) pending precompile verification and independent review.

X Layer is an experimental second engine for Syndicate. **Base/Megapot remains the product home.** The X Layer design moves the game into a Uniswap v4 hook: trading surcharges fund a prize pot, depositor shares set draw odds, and principal remains redeemable between draws.

## Product and game model

- Users deposit USDC into the hook and receive shares.
- Swaps route through `PrizePoolSwapRouter`.
- The router withholds a configured surcharge; the hook physically pulls USDC during `afterSwap`.
- `openDraw()` snapshots shares and pot balance, preventing deposit/withdraw timing games.
- A randomness oracle resolves a weighted winner.
- The winner claims the pot; principal is not consumed.

FWA is inspiration for weighted selection, FIFO snapshots, and keep-or-exit dynamics—not evidence that FWA uses v4 hooks. The X Layer hook is our proposed novelty.

## Current implementation

- `contracts/xlayer/PrizePoolHook.sol` — deposits, shares, pot, snapshots, weighted draw, timelocked settings.
- `contracts/xlayer/PrizePoolSwapRouter.sol` — exact-in swap wrapper, surcharge withholding, refund-on-revert.
- `contracts/xlayer/PrizePoolHookFactory.sol` — atomic CREATE2 deployment, wiring, initialization, and ownership transfer.
- `contracts/xlayer/SimpleRandomnessOracle.sol` — operator-controlled testnet demo oracle only.
- `script/DeployV4CoreXLayer.s.sol` — self-deploy v4 core on testnet.
- `script/DeployPrizePoolHook.s.sol` — deploy the hook stack (precomputes CREATE2 salt before broadcast; optional `HOOK_SALT`).
- `src/config/xlayer.ts` — chain, address, ABI, and explorer helpers.
- `src/app/xlayer/page.tsx` — prize pool dashboard route.
- `src/components/xlayer/PrizePoolDashboard.tsx` — pot, shares, draw, surcharge; all reads poll on a 12s interval.
- `src/components/xlayer/XLayerGuidedFlow.tsx` — interactive stranger walkthrough (connect → switch chain → faucet → deposit or swap join → agent), each step auto-checking from live on-chain state. Surfaced in primary nav as "Agent Pool" (Testnet flag) and from the homepage Agent Pool section.
- `src/components/xlayer/XLayerOperatorRunReplay.tsx` — public replay of the latest operator run; no wallet required.
- `src/services/jobs/xlayerKeeperProcessor.ts` + `src/app/api/crons/xlayer-keeper/route.ts` — hourly operator keeper (see Operator keeper below).
- `src/lib/db/migrations/016-add-agent-run-events.sql` + `src/lib/db/repositories/agentRunRepository.ts` — server-side persistence for keeper transitions; `GET /api/agent/xlayer/latest-run` serves the latest session for replay.
- `src/services/xlayer/useXLayerDeposit.ts` — principal deposit + owner `fundPot`.
- `src/services/agents/tools/` — shared tool registry (X Layer + Base yield/autopilot).

The contract suite has 104 Foundry tests. The app slice has 3 config tests plus the Virtuals route regression suite used by the build gate.

## Network facts

| Item | Testnet | Mainnet |
|---|---|---|
| Chain ID | **1952** | 196 |
| RPC | `https://testrpc.xlayer.tech/terigon` | `https://rpc.xlayer.tech` |
| Gas | OKB | OKB |
| Pot / deposit token | Faucet **USDC_TEST** `0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d` | USDC `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| Pair token (TOKEN1) | WOKB `0x4200000000000000000000000000000000000006` | WOKB / paired asset |
| PoolManager | Self-deployed (see live addresses) | Canonical `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |
| Explorer | https://www.okx.com/web3/explorer/xlayer-test | https://www.okx.com/web3/explorer/xlayer |

Testnet has no official v4 deployment, so deploy PoolManager yourself. The OKX faucet issues `USDC_TEST` / `USDG` / `USD₮0` — not the older docs USDC address. Mainnet deployment waits on the randomness design above passing its two gates.

## Live testnet deployment (Build X AI Season)

Deployed 2026-08-09 on chain 1952. Surcharge: 100 bps. Demo oracle only.

| Contract | Address |
|---|---|
| PoolManager | `0x49f01fEEbd2e32e380D09dAff2d02b76E783816C` |
| PrizePoolHook | `0x6B975aB90FBC90157b67bAA38F0fa90bae1710c0` |
| PrizePoolSwapRouter | `0x256E473c90230d6b022E93019759e53B515b287C` |
| SimpleRandomnessOracle | `0x48fF718A9aE775214f207E992fa49d36C02c2858` |
| Factory (one-shot) | `0x2372C42B9aE737cd07da38636c61772c28Ab9a3b` |

Verified: hook flags `address & 0x3FFF == 0x10C0`, `poolBound == true`, pot currency = USDC_TEST.

## Randomness decision

*(Formally reviewed for the Build X AI Season submission, 2026-08-11.)*

Verified on 2026-08-11: **Chainlink VRF and Pyth Entropy are not deployed on X Layer** (checked Chainlink integration announcements and the `pyth-network/pyth-crosschain` chain registry). The contract uses `IRandomnessOracle`, so the source can change without changing draw logic.

- **Testnet:** `SimpleRandomnessOracle`, disclosed operator-controlled demo only.
- **Production design (primary): drand + permissionless relay.** The League of Entropy beacon network (20+ institutions, threshold-signed rounds, 3s/30s modes) makes winner selection publicly reproducible by anyone, without trusting us or a single relay. Design invariants:
  - Winner input is `keccak256(drandRoundSeed, potSnapshotId)` where the drand round is chosen from `block.number` at `openDraw()` — the operator cannot pick favorable rounds after the pot snapshots.
  - On-chain verification of the beacon: BLS12-381 verify via EIP-2537 precompiles. **Verified 2026-08-11 on testnet 1952 by calibrated probe:** `G1ADD (0x0b)` accepts valid encoding and malformed-length `PAIRING (0x0f)` input reverts with a real `PrecompileError` (an absent precompile returns empty success instead). Mainnet 196 should be probed identically pre-launch, but X Layer's Polygon CDK lineage makes parity expected.
  - Fallback if mainnet probes fail: two-tier bridge — a bonded relay posts beacon signatures with a **challenge window**; any third party can verify the round off-chain and challenge wrong roots, slashing the bond. Draws with prizes below a threshold can resolve unchallenged after the window.
  - Relay is permissionless: anyone may submit the signed round; replay protection by `(chainId => round => used)` mapping.
- **Fallback (if drand verification is not viable):** two-party commit-reveal — operator seed committed at `openDraw()`, player-contributed entropy folded per ticket at purchase, reveal after close with slashed-bond penalties for withheld reveals.
- **Never:** use the demo oracle or bare block-derived values for real-value draws.

Mainnet gate: launch requires (a) the matching precompile probe on chain 196, and (b) independent review of the relay + winner-mapping code, before any non-trivial TVL.

## Testnet deployment

Prerequisites: Foundry (`~/.foundry/bin/forge`), funded testnet wallet (OKB + faucet USDC_TEST), RPC above.

```bash
PRIVATE_KEY=0x... \
forge script script/DeployV4CoreXLayer.s.sol \
  --rpc-url https://testrpc.xlayer.tech/terigon --broadcast -vv
```

Record `PoolManager`, then:

```bash
PRIVATE_KEY=0x... \
HAS_POOL_MANAGER=true \
POOL_MANAGER_ADDRESS=<pool-manager> \
USDC_ADDRESS=0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d \
TOKEN1_ADDRESS=0x4200000000000000000000000000000000000006 \
HAS_SURCHARGE_BPS=true \
SURCHARGE_BPS=100 \
forge script script/DeployPrizePoolHook.s.sol \
  --rpc-url https://testrpc.xlayer.tech/terigon --broadcast -vv
```

Optional: set `HAS_HOOK_SALT=true` and `HOOK_SALT=<n>` after mining a CREATE2 salt that yields flags `0x10C0`. The script otherwise searches locally before broadcast.

Verify the hook permission mask, pool initialization, surcharge settings, and emitted deployment addresses.

## Connect the app

Add the deployed addresses to `.env.local`:

```bash
NEXT_PUBLIC_XLAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech/terigon
NEXT_PUBLIC_XLAYER_TESTNET_USDC_ADDRESS=0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d
NEXT_PUBLIC_XLAYER_PRIZE_POOL_HOOK_ADDRESS=0x6B975aB90FBC90157b67bAA38F0fa90bae1710c0
NEXT_PUBLIC_XLAYER_PRIZE_POOL_ROUTER_ADDRESS=0x256E473c90230d6b022E93019759e53B515b287C
NEXT_PUBLIC_XLAYER_POOL_MANAGER_ADDRESS=0x49f01fEEbd2e32e380D09dAff2d02b76E783816C
NEXT_PUBLIC_XLAYER_ORACLE_ADDRESS=0x48fF718A9aE775214f207E992fa49d36C02c2858
NEXT_PUBLIC_XLAYER_WRITES_ENABLED=true  # required for deposit / join / fundPot demo
```

Restart the app and open `/xlayer`. Missing or malformed addresses produce a safe preview state. Writes stay off until `NEXT_PUBLIC_XLAYER_WRITES_ENABLED=true` and the capability registry allows them.

## Demo loop (testnet)

1. Enable writes (env above) and connect an X Layer testnet wallet with USDC_TEST.
2. **Deposit principal** (lossless shares) and/or **Join via swap** (shares + surcharge).
3. If pot is below min and you are hook owner: agent may propose **fundPot**, or seed manually.
4. **Plan next actions** → approve HITL → sign **openDraw**.
5. Oracle owner: **setDemoOracle** → anyone: **fulfillRandomness** → winner: **claimPrize**.

Record a short screen capture of this loop for Build X submission. Do not use the demo oracle for real-value draws.

## Agent loop (tool registry + HITL)

`/xlayer` includes an **agent loop** panel (`XLayerAgentPanel`):

1. **Tool registry** — typed tools (`getPoolState`, `recommendSurcharge`, `deposit`, `fundPot`, `openDraw`, `setDemoOracle`, `fulfillRandomness`, `claimPrize`) with capability, HITL, and receipt gates. `deposit` / `fundPot` require the write gate.
2. **Plan** — `POST /api/agent/xlayer/plan` (Venice or heuristic) → structured tool steps.
3. **HITL** — Approve / Reject each mutating tool card before signing.
4. **Execute → observe** — wallet hooks + receipt confirmation (pending is never success).
5. **Session memory** — last plan, tx, epoch, oracle value, short history.

Base product-home tools (`base.getYieldSnapshot`, `base.planYieldSpend`, `base.proposeAutopilotPolicy`) live in the same registry via `POST /api/agent/base/plan` (canonical advice + plan). `POST /api/agent/autopilot/advice` is a thin compatibility wrapper over the same resolver. Client hooks share `useAgentLoop`. MetaMask permission approval remains the Base write boundary.

Legacy advice endpoint `POST /api/agent/xlayer/advice` remains available. Optional: `VENICE_API_KEY` for live Venice plans.

## Operator keeper (cron)

The interactive panel is human-in-the-loop; a stranger who deposits still cannot open draws (owner/oracle/winner gates). So the pool stays alive between visitors, `GET /api/crons/xlayer-keeper` runs on a schedule (Vercel Cron) as the operator-side complement:

- **Per tick — full-cycle chaining:** the demo flow has no waiting requirement, so one tick runs every stage the current state allows: open draw → seed demo oracle → `fulfillRandomness` → claim (only when the operator actually won), re-reading on-chain state between stages. One cron run completes a whole epoch — important on Hobby tier, where crons are daily only. Topping up via owner `fundPot` (with ERC-20 approval) happens first when the pot is below the minimum. Capped at 6 transactions / 4 stages per tick.
- **Fail-closed:** without `XLAYER_KEEPER_PRIVATE_KEY` the route reports `attempted: false` and records nothing. The key must be a **testnet-only** operator key (it owns the hook and oracle and holds only testnet funds). `XLAYER_KEEPER_FUND_POT_USDC` sets the top-up size (default 25; the shortfall is always covered).
- **Receipt-verified:** every action waits for its receipt and records `fail` on revert — never a fabricated hash.
- **Persisted + public:** transitions land in `agent_run_events` (migration 016; run `pnpm db:migrate`). `GET /api/agent/xlayer/latest-run` returns the most recent session, replayed read-only on `/xlayer` — judges and strangers can audit the agent with no wallet.

Cron auth uses the shared `CRON_SECRET` bearer pattern. Schedule in `vercel.json`: `0 0 * * *` (Hobby tier is daily-only). For a livelier cadence during judging, `.github/workflows/xlayer-keeper.yml` pings the same endpoint hourly (inert until the `KEEPER_PING_URL` and `CRON_SECRET` repo secrets are set; GitHub scheduled jobs can lag 10–30m). Manual trigger for demos: `curl -H "Authorization: Bearer $CRON_SECRET" <app>/api/crons/xlayer-keeper`.

## Roadmap and safety gates

1. ~~Deploy and verify one testnet pool.~~ Done (addresses above).
2. Replace the demo oracle with independently reviewed drand verification.
3. Complete M3 LP position management, fee splitting, and non-USDC conversion.
4. ~~Add explicitly gated deposit, withdraw, draw, claim, AI keeper, and syndicate flows.~~
   Agent loop + deposit/fundPot/join write path shipped on `/xlayer` (env-gated).
   Syndicate wiring still open.
5. Only then evaluate a mainnet deployment against the canonical PoolManager.

Before mainnet: add rejection sampling, timelock all configuration/recovery paths, review custody assumptions, and independently review oracle cryptography.
