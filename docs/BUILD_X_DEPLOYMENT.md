# Prize Pool Hook — Deployment Runbook

Deploys the lossless-lottery DEX stack on OKX X Layer. Companion to
[BUILD_X_HOOK_SPEC.md](./BUILD_X_HOOK_SPEC.md) and
[BUILD_X_STRATEGY.md](./BUILD_X_STRATEGY.md).

## Stack

```
PoolManager (v4 core)                     — canonical on mainnet, self-deployed on testnet
PrizePoolHook  (CREATE2, flags 0x10C0)    — pot, draws, afterSwap pot funding
PrizePoolSwapRouter                       — swaps route here; withholds the pot surcharge
SimpleRandomnessOracle                    — TESTNET demo only (M4 → drand)
```

The hook's deployed address must satisfy `address & 0x3FFF == 0x10C0`
(AFTER_INITIALIZE | BEFORE_SWAP | AFTER_SWAP) — the deploy script finds it via CREATE2
salt search automatically.

## Prerequisites

- Foundry (CI pins v1.2.3 via foundry-toolchain; local `~/.foundry/bin/forge`).
- A testnet wallet funded with testnet OKB (X Layer testnet faucet) + testnet USDC.
- X Layer testnet RPC: `https://testrpc.xlayer.tech/terigon`
  (or `https://xlayertestrpc.okx.com/terigon`).
- Mainnet RPC: `https://rpc.xlayer.tech` (or `https://xlayerrpc.okx.com`).

## Testnet (chain 195) — full demo setup

### 1. Self-deploy Uniswap v4 core

X Layer testnet has no official v4 deployment, so deploy the PoolManager yourself:

```bash
PRIVATE_KEY=0x... \
forge script script/DeployV4CoreXLayer.s.sol \
  --rpc-url https://testrpc.xlayer.tech/terigon --broadcast -vv
```

Record the printed `PoolManager` address.

### 2. Deploy the hook stack

```bash
PRIVATE_KEY=0x... \
POOL_MANAGER_ADDRESS=<from step 1> \
USDC_ADDRESS=0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3 \
TOKEN1_ADDRESS=<WOKB / test token address> \
SURCHARGE_BPS=100 \
forge script script/DeployPrizePoolHook.s.sol \
  --rpc-url https://testrpc.xlayer.tech/terigon --broadcast -vv
```

The script deploys a `PrizePoolHookFactory`, the testnet randomness oracle, and the
hook/router stack through one atomic factory transaction. The factory searches for the
CREATE2 address with permission bits `0x10C0`, configures the hook, initializes the
USDC/TOKEN1 0.3% pool, wires the router, and transfers hook ownership to the final owner.
Record all printed addresses.

### 3. Verify onchain

- [ ] Hook address ends with the right bits: `cast code <hook>` on OKLink
      (https://www.oklink.com/x-layer-testnet) — or locally:
      `cast compute-address --nonce ... ` (deploy script prints `flags: 4288`).
- [ ] Pool initialized: call `poolManager.initialize` state / check the `Initialize`
      event on the explorer.
- [ ] `surchargeEnabled == true`, `surchargeBps == 100`.

### 4. Demo flow (the 60-second loop)

1. `hook.deposit(amount)` — user deposits USDC (principal preserved).
2. `router.swapExactInput(zeroForOne, amountIn, minOut, 0)` — a swap; the 1% surcharge
   lands in `hook.potBalance()` **during afterSwap** (check `SwapSurcharged` event).
3. `oracle.setNextValue(epochId, v)` — operator (AI agent) picks the disclosed testnet-only demo value for that epoch.
4. `hook.openDraw()` — anyone; snapshots shares + pot.
5. `hook.fulfillRandomness(v, "")` — resolves the draw (winner weighted by shares).
6. `hook.claimPrize()` — winner receives the pot; principal untouched.

## Mainnet (chain 196) — hackathon requirement

The rules require launching on X Layer Mainnet. Steps differ only in the core:

```bash
PRIVATE_KEY=0x... \
POOL_MANAGER_ADDRESS=0x360e68faccca8ca495c1b759fd9eee466db9fb32 \
USDC_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061 \
TOKEN1_ADDRESS=<WOKB mainnet> \
forge script script/DeployPrizePoolHook.s.sol \
  --rpc-url https://rpc.xlayer.tech --broadcast -vv
```

Mainnet deployment is intentionally blocked by the script until a separately reviewed drand oracle is supplied. Mainnet caveats (before real money):

- Swap `SimpleRandomnessOracle` for a separately reviewed drand oracle (M4). The
  current oracle is epoch-scoped but operator-controlled and must not secure real-value
  draws.
- Post-bind changes to surcharge, oracle, minimum pot, draw cooldown, and draw timeout
  require the two-day `scheduleConfiguration` → `executeConfiguration` timelock.
  Router replacement uses the separate two-day `scheduleRouterChange` →
  `executeRouterChange` recovery path. The factory applies initial values before
  ownership transfer.
- The hook includes a one-day draw-resolution timeout and permissionless `cancelDraw()` escape;
  keep the timeout conservative before real money.
- Consider locking the swap router to the hook's own pool only (it already validates
  the key at construction).

## Links

- X Layer testnet explorer: https://www.okx.com/web3/explorer/xlayer-test / OKLink
- X Layer mainnet explorer: https://www.okx.com/web3/explorer/xlayer / OKLink
- Testnet USDC: `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`
- Mainnet USDC: `0xB6CEceAB302E2E4948951eE7843FC24E92933061`
