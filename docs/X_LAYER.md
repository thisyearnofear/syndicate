# X Layer Prize Pool Hook

**Status:** M2 contract stack hardened; read-only `/xlayer` app slice shipped; testnet deployment pending.

X Layer is an experimental second engine for Syndicate. Base/Megapot remains the existing lottery path. The X Layer design moves the game into a Uniswap v4 hook: trading surcharges fund a prize pot, depositor shares set draw odds, and principal remains redeemable between draws.

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
- `script/DeployPrizePoolHook.s.sol` — deploy the hook stack.
- `src/config/xlayer.ts` — chain, address, ABI, and explorer helpers.
- `src/app/xlayer/page.tsx` — read-only dashboard route.
- `src/components/xlayer/PrizePoolDashboard.tsx` — pot, shares, draw, surcharge, and user-odds UI.

The contract suite has 104 Foundry tests. The app slice has 3 config tests plus the Virtuals route regression suite used by the build gate.

## Network facts

| Item | Testnet | Mainnet |
|---|---:|---:|
| Chain ID | 195 | 196 |
| RPC | `https://testrpc.xlayer.tech/terigon` | `https://rpc.xlayer.tech` |
| Gas | OKB | OKB |
| USDC | `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3` | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| PoolManager | self-deployed | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |

Testnet has no official v4 deployment, so deploy PoolManager and periphery yourself. Mainnet deployment is blocked until the randomness path is production-safe.

## Randomness decision

Chainlink VRF and Pyth Entropy are not available on X Layer. The contract uses `IRandomnessOracle` so the source can change without changing draw logic.

- **Testnet:** `SimpleRandomnessOracle`, disclosed operator-controlled demo only.
- **Production plan:** drand beacon plus permissionless relay with verification and replay protection.
- **Never:** use the demo oracle or block-derived values for real-value draws.

## Testnet deployment

Prerequisites: Foundry, funded testnet wallet, testnet OKB, and testnet USDC.

```bash
PRIVATE_KEY=0x... \
forge script script/DeployV4CoreXLayer.s.sol \
  --rpc-url https://testrpc.xlayer.tech/terigon --broadcast -vv
```

Record `PoolManager`, then:

```bash
PRIVATE_KEY=0x... \
POOL_MANAGER_ADDRESS=<pool-manager> \
USDC_ADDRESS=0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3 \
TOKEN1_ADDRESS=<test-token> \
SURCHARGE_BPS=100 \
forge script script/DeployPrizePoolHook.s.sol \
  --rpc-url https://testrpc.xlayer.tech/terigon --broadcast -vv
```

Verify the hook permission mask (`address & 0x3FFF == 0x10C0`), pool initialization, surcharge settings, and emitted deployment addresses.

## Connect the app

Add the deployed addresses to `.env.local`:

```bash
NEXT_PUBLIC_XLAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech/terigon
NEXT_PUBLIC_XLAYER_TESTNET_USDC_ADDRESS=0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3
NEXT_PUBLIC_XLAYER_PRIZE_POOL_HOOK_ADDRESS=<hook>
NEXT_PUBLIC_XLAYER_PRIZE_POOL_ROUTER_ADDRESS=<router>
NEXT_PUBLIC_XLAYER_POOL_MANAGER_ADDRESS=<pool-manager>
```

Restart the app and open `/xlayer`. Missing or malformed addresses produce a safe preview state. The dashboard is read-only until testnet safety checks and transaction gating are complete.

## Roadmap and safety gates

1. Deploy and verify one testnet pool.
2. Replace the demo oracle with independently reviewed drand verification.
3. Complete M3 LP position management, fee splitting, and non-USDC conversion.
4. Add explicitly gated deposit, withdraw, draw, claim, AI keeper, and syndicate flows.
5. Only then evaluate a mainnet deployment against the canonical PoolManager.

Before mainnet: add rejection sampling, timelock all configuration/recovery paths, review custody assumptions, and independently review oracle cryptography.
