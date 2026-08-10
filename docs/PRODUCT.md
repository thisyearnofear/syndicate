# Product

## North star

> **Keep your capital. Its earnings play — alone or as a group, publicly or privately.**

Syndicate is one mechanism with four expressions: the lottery (Play), the vaults (Grow), syndicates (Coordinate), and the X Layer hook are all instances of "your capital doesn't play — its earnings do." See [`POSITIONING.md`](POSITIONING.md) for the positioning decision, surface ownership, and claim rules.

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

Fhenix flows encrypt vault positions and on-vault contribution state; authorized users reveal their own data locally through permits.

Scope of the privacy claim today (per `POSITIONING.md`): balances inside the Fhenix vault are private; the underlying USDC transfer amount of a deposit is still visible in the ERC-20 `Transfer` event. Copy must say "private balances inside the vault," not "private deposits" or "encrypted contributions," until Fhenix mainnet or a shielded funding path exists.

The default verification provider is intentionally a noop; real KYC is opt-in infrastructure, not the product's default experience.

### Automation

ERC-7715, x402, 1Shot, and Virtuals provide bounded execution paths. The user remains the authorization boundary: policies are scoped, revocable, and recorded.

## X Layer concept

X Layer extends the same “keep your capital, use the earnings” idea to a DEX-native game. A Uniswap v4 hook collects a real trading surcharge into a prize pot, snapshots depositor shares, and selects a weighted winner. The Base/Megapot engine remains unchanged; X Layer is an additional experimental engine.

The current X Layer app slice at `/xlayer` supports a testnet demo loop (deposit / swap join / fundPot / agent HITL draw). Writes require `NEXT_PUBLIC_XLAYER_WRITES_ENABLED=true`. See [`X_LAYER.md`](X_LAYER.md).
