# Product

## The short version

Syndicate helps groups coordinate capital on-chain without forcing every position to be public.

The product combines:

1. **Yield strategies** — capital can earn yield in Base vaults.
2. **Lottery participation** — earned yield can buy Megapot tickets while principal remains intact.
3. **Syndicates** — groups coordinate shared pools and distribution rules.
4. **Privacy** — Fhenix can encrypt eligible balances and contributions.
5. **Automation** — users approve bounded, revocable actions rather than handing over unrestricted custody.

Syndicate is not trying to replace Megapot or PoolTogether. Those protocols provide core primitives; Syndicate is the coordination, routing, privacy, and automation layer above them.

## Chain model

| Layer | Role |
|---|---|
| **Base** | Product execution: vaults, syndicates, settlement, and Megapot purchases |
| **Fhenix** | Privacy layer for encrypted vault and syndicate flows |
| **Solana, Stacks, NEAR, Ethereum, Starknet** | Funding and routing rails into the Base-native experience |
| **X Layer** | Experimental second engine: trading-fee-funded Prize Pool Hook |

Do not describe every chain as an equal product home. Base executes, Fhenix adds privacy, and the other chains primarily provide access and funding.

## Core user flows

### Yield-to-tickets

1. Deposit USDC into a supported Base yield strategy.
2. Yield accrues while principal remains the user's capital.
3. The yield service can route accrued yield into Megapot ticket purchases.
4. Automation executes only within the user's configured policy.

### Syndicates

Users create or join pools backed by Safe, 0xSplits, PoolTogether, or Fhenix. Pool type determines custody, distribution, and privacy behavior.

### Privacy

Fhenix flows encrypt contribution amounts and vault positions. Authorized users can reveal their own data locally through permits. The default verification provider is intentionally a noop; real KYC is opt-in infrastructure, not the product's default experience.

### Automation

ERC-7715, x402, 1Shot, and Virtuals provide bounded execution paths. The user remains the authorization boundary: policies are scoped, revocable, and recorded.

## X Layer concept

X Layer extends the same “keep your capital, use the earnings” idea to a DEX-native game. A Uniswap v4 hook collects a real trading surcharge into a prize pot, snapshots depositor shares, and selects a weighted winner. The Base/Megapot engine remains unchanged; X Layer is an additional experimental engine.

The current X Layer app slice is read-only at `/xlayer`. See [`X_LAYER.md`](X_LAYER.md).
