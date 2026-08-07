# X Layer App Integration

The first app slice for the Prize Pool Hook lives at `/xlayer`.

It is intentionally **read-first**: the dashboard can show the deployed hook's pot,
shares, draw state, surcharge policy, and a connected user's odds, but it does not expose
money-moving actions until a real testnet deployment is configured.

## Configure a testnet deployment

Set these public environment variables in `.env.local` after deploying the stack with
`script/DeployPrizePoolHook.s.sol`:

```bash
NEXT_PUBLIC_XLAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech/terigon
NEXT_PUBLIC_XLAYER_TESTNET_USDC_ADDRESS=0x...
NEXT_PUBLIC_XLAYER_PRIZE_POOL_HOOK_ADDRESS=0x...
NEXT_PUBLIC_XLAYER_PRIZE_POOL_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_XLAYER_POOL_MANAGER_ADDRESS=0x...
```

The app validates all three deployment addresses before enabling contract reads. If any
address is absent or malformed, `/xlayer` remains a useful product preview and displays a
clear “deployment slot is ready” state instead of querying a zero address.

## Included behavior

- X Layer Testnet is registered with wagmi as chain `195`.
- The wallet UI labels chain `195` as **X Layer Testnet** and marks it as a testnet.
- `/xlayer` reads `potBalance`, `totalShares`, `draw`, `shares`, `principal`, draw settings,
  and the surcharge policy from the hook.
- Share odds are calculated with bigint arithmetic to avoid precision loss.
- The dashboard links configured contracts to the OKLink X Layer testnet explorer.
- X Layer Mainnet (`196`) remains explicitly blocked pending the production drand oracle.

## Next app slice

After the testnet addresses are available, add explicitly gated transaction flows for:

1. depositing and withdrawing principal;
2. opening a draw and fulfilling the demo randomness value;
3. claiming a resolved prize;
4. AI-assisted keeper actions with a user-approved testnet policy.

Those actions should remain hidden or disabled until the dashboard has verified the chain,
contract addresses, and testnet-only safety mode.
