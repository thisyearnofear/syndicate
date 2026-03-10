# Starknet Integration Plan

**Last Updated**: March 10, 2026  
**Status**: ✅ **Phase 3 Complete** — Cairo contract deployed, bridge protocol implemented, wallet UI integrated!  
**Context**: [Starknet Re{define} Hackathon](https://hackathon.starknet.org/) | [DoraHacks](https://dorahacks.io/hackathon/redefine/detail)

---

## Overview

Add **Starknet as a source chain** so users can purchase [Megapot](https://docs.megapot.io/) lottery tickets from Starknet wallets. Megapot is an **external lottery protocol on Base** — we do not control its contracts. Syndicate's role is to bridge funds from source chains to the existing `MegapotAutoPurchaseProxy` on Base, which atomically purchases tickets on behalf of the user.

The **privacy track** is the primary target. A deployed Cairo contract on Starknet that provides private ticket commitments is the core deliverable — it gives us a Starknet deployment link, a ZK-native story, and differentiates us from a plain bridge integration.

---

## Submission Checklist

Per [DoraHacks requirements](https://dorahacks.io/hackathon/redefine/detail):

- [x] **Working demo/prototype deployed on Starknet** (testnet or mainnet) ✅
  - Contract: `0x03973de0e8327336b14981b2897afc0eeb075764d3c28409f5c02177d5e9085b` on Sepolia
- [x] **Bridge protocol implementation** ✅
  - `src/services/bridges/protocols/starknet.ts` — Orbiter Finance integration
- [x] **Wallet integration** ✅
  - ArgentX/Braavos support in `unifiedWalletService.ts`
  - Starknet option in wallet selector UI
- [ ] **Public GitHub repository** with source code
- [ ] **Project description** (max 500 words)
- [ ] **3-minute demo video**
- [ ] **Starknet wallet address** for prize distribution

### Deadline

- **Extended**: March 10, 2026 — 11:59 PM UTC
- **Judging**: March 11–25, 2026
- **Winners announced**: March 28, 2026

---

## Hackathon Fit

### Target track: 🔒 Privacy ($9,675 STRK)

Maps to curated hackathon ideas:
- **Sealed-bid auction** — lottery ticket purchases are sealed commitments revealed only after the draw
- **Private payment app** — cross-chain private purchases via ZK proofs
- **Shielded wallet UI** — users see their own tickets but others cannot link purchases to identities

### Fallback track: 🚀 Wildcard ($2,150 STRK)

Cross-chain consumer app / gaming / payments — the bridge integration alone qualifies here.

### Why Syndicate stands out

- **Live product** with real users, not a hackathon toy — already supports 4 source chains
- **Privacy is natural** — lottery buyers benefit from anonymity (prevents front-running, social pressure)
- **Modular architecture** — adding a chain is well-scoped, proven pattern
- **Deployable Cairo contract** — not just a bridge; a ZK-native privacy layer on Starknet

---

## Judging Criteria Mapping

| Likely criteria | How we score |
|----------------|--------------|
| **Technical complexity** | Cross-chain bridge + Cairo privacy contract + ZK commitment scheme |
| **Innovation** | First cross-chain lottery with ZK-private ticket purchases |
| **Starknet-native** | Cairo contract deployed on Starknet, uses STARK proofs natively |
| **Working demo** | Live product — just adding Starknet as 5th chain |
| **Completeness** | End-to-end flow: connect wallet → private commit → bridge → tickets |
| **Privacy focus** | Core of the submission: hide buyer identity + ticket count on-chain |

---

## Architecture

### How it works today (any chain → Base)

```
User Wallet (source chain)
       │
       ▼
  Bridge Protocol (chain-specific)
       │
       ▼
  MegapotAutoPurchaseProxy (Base)   ← we control this
       │
       ▼
  Megapot Contract (Base)           ← external, not ours (docs.megapot.io)
       │
       ▼
  Tickets credited to user
```

### Starknet flow (proposed)

```
Starknet Wallet (ArgentX / Braavos)
       │
       ├─[1] User connects wallet on Syndicate frontend
       │     └→ Selects ticket count, reviews cost breakdown
       │
       ├─[2] Private commit on Starknet (Cairo contract)
       │     ├→ User calls commit(hash(recipient, ticketCount, salt))
       │     ├→ Deposits USDC into the privacy contract
       │     └→ On-chain: only the commitment hash is visible, not the details
       │
       ├─[3] Bridge USDC from Starknet → Base
       │     └→ Privacy contract releases funds to bridge
       │     └→ Destination: MegapotAutoPurchaseProxy on Base
       │
       └─[4] Proxy executes purchase on Megapot
             ├→ executeBridgedPurchase(amount, recipient, referrer, bridgeId)
             └→ Tickets credited to user's Base address
```

---

## Cairo Contract Spec: `PrivateTicketCommitment`

This is the **core hackathon deliverable** — a Cairo contract deployed on Starknet.

### Purpose

Allow users to commit to lottery ticket purchases privately. The commitment hides:
- **Who** is buying (buyer address is not linked to the commitment on-chain)
- **How many** tickets (ticket count is inside the hash)

### Interface

```cairo
#[starknet::interface]
trait IPrivateTicketCommitment<TContractState> {
    /// Commit to a future ticket purchase.
    /// commitment = pedersen(recipient, ticket_count, salt)
    /// User deposits USDC equal to ticket_count * TICKET_PRICE.
    fn commit(ref self: TContractState, commitment: felt252, usdc_amount: u256);

    /// Reveal and release funds to the bridge.
    /// Verifies pedersen(recipient, ticket_count, salt) == stored commitment.
    /// Emits event with bridge details; funds sent to bridge contract.
    fn reveal_and_bridge(
        ref self: TContractState,
        commitment_id: u64,
        recipient: felt252,       // Base address (felt-encoded)
        ticket_count: u32,
        salt: felt252,
        bridge_recipient: felt252, // Bridge contract on Starknet
    );

    /// View: check if a commitment exists (without revealing details).
    fn has_commitment(self: @TContractState, commitment_id: u64) -> bool;

    /// View: total commitments (public counter, no details exposed).
    fn total_commitments(self: @TContractState) -> u64;
}
```

### Storage

```cairo
#[storage]
struct Storage {
    // commitment_id → commitment hash
    commitments: LegacyMap::<u64, felt252>,
    // commitment_id → deposited amount
    deposits: LegacyMap::<u64, u256>,
    // commitment_id → revealed flag
    revealed: LegacyMap::<u64, bool>,
    // auto-incrementing ID
    next_id: u64,
    // ticket price in USDC (6 decimals)
    ticket_price: u256,
    // USDC token address on Starknet
    usdc_address: felt252,
}
```

### Events

```cairo
#[event]
#[derive(Drop, starknet::Event)]
enum Event {
    CommitmentCreated: CommitmentCreated,
    CommitmentRevealed: CommitmentRevealed,
}

#[derive(Drop, starknet::Event)]
struct CommitmentCreated {
    commitment_id: u64,
    commitment_hash: felt252,  // opaque — hides buyer + ticket count
    timestamp: u64,
}

#[derive(Drop, starknet::Event)]
struct CommitmentRevealed {
    commitment_id: u64,
    ticket_count: u32,         // now public (after draw or timeout)
    bridge_recipient: felt252, // where funds are going
}
```

### Privacy Properties

| Property | How |
|----------|-----|
| **Buyer anonymity** | Commitment hash doesn't contain the caller's address; `recipient` is inside the hash |
| **Amount hiding** | `ticket_count` is inside the Pedersen hash; USDC deposit amount is visible but could be padded |
| **Timing privacy** | Commit and reveal can be separated by arbitrary time |
| **Unlinkability** | Different `salt` per commitment; no on-chain link between commit tx sender and Base recipient |

### Deployment

**✅ Deployed on Starknet Sepolia (March 10, 2026)**

| Field | Value |
|-------|-------|
| **Contract Address** | `0x04031300bdb712cd214f78a115c5f6cde39fe5eb2f8caa9621625338e7b726f4` |
| **Class Hash** | `0x5bcf8f53c37dfcefec9f1885d4aa6dc37169d62ab4e297373eba2c819348222` |
| **Network** | Starknet Sepolia Testnet |
| **Owner** | `0x23e62ffc2122b734cb6df18d9920001ccb5acde8a775592820049b9e27855df` |
| **Deploy Tx** | `0x06b3f1288986a083c0c89043bfe5dddecc2fce25eaaaf9b6fbeb27adf7ffff58` |

**Voyager Links:**
- [Contract](https://sepolia.voyager.online/contract/0x04031300bdb712cd214f78a115c5f6cde39fe5eb2f8caa9621625338e7b726f4)
- [Transaction](https://sepolia.voyager.online/tx/0x06b3f1288986a083c0c89043bfe5dddecc2fce25eaaaf9b6fbeb27adf7ffff58)

```bash
# Compile
cd contracts/starknet && scarb build

# Declare (completed)
sncast -a sonicguardian declare --contract-name PrivateTicketCommitment --network sepolia

# Deploy (completed)
sncast -a sonicguardian deploy \
  --class-hash 0x220f5415c7e7a2e560263134990edb444550c700d61b867ef4f8322e039124f \
  --arguments 0x23e62ffc2122b734cb6df18d9920001ccb5acde8a775592820049b9e27855df \
  --network sepolia
```

---

## Implementation Plan

### Phase 1: Cairo Contract (2-3 days) ⭐ CRITICAL ✅ COMPLETE

**Goal**: Deployed `PrivateTicketCommitment` contract on Starknet Sepolia — this is the submission's deployment link.

1. **Set up Cairo project**
   - `contracts/starknet/` directory with `Scarb.toml`
   - Use OpenZeppelin Cairo contracts for ERC20 interaction

2. **Implement `PrivateTicketCommitment`**
   - Pedersen commitment scheme (native to Cairo — zero extra libraries)
   - USDC deposit on commit, release on reveal
   - Events for indexing

3. **Test with `snforge`**
   - Unit tests for commit/reveal cycle
   - Test invalid reveal (wrong salt) reverts
   - Test double-reveal prevention

4. **Deploy to Sepolia**
   - Declare and deploy via `sncast`
   - Verify on Starkscan/Voyager
   - **Save deployment link for submission**

### Phase 2: Bridge Integration (2-3 days) ✅ COMPLETE

**Goal**: USDC moves from Starknet `PrivateTicketCommitment` → `MegapotAutoPurchaseProxy` on Base.

1. **Add Starknet to bridge types**
   - `src/services/bridges/types.ts` — add `'starknet'` to `SupportedChain`
   - `src/services/bridges/protocols/starknet.ts` — new protocol implementing `BridgeProtocol` interface

2. **Bridge protocol implementation**
   - Implement `getQuote()`, `bridge()`, `getStatus()`, `healthCheck()`
   - Integrate chosen bridge SDK (Orbiter/LayerSwap/deBridge)
   - Wire `externalCall` to `executeBridgedPurchase()` on the proxy (same pattern as Solana/deBridge)

3. **Register in UnifiedBridgeManager**
   - `src/services/bridges/index.ts` — add Starknet protocol to manager
   - `src/services/bridges/strategies/bridgeStrategy.ts` — add Starknet selection logic

### Bridge Options (Starknet → Base)

| Bridge | Type | Notes |
|--------|------|-------|
| **StarkGate** | Official Starknet bridge | Starknet ↔ Ethereum L1; would need a second hop (L1 → Base) |
| **Orbiter Finance** | Third-party | Supports Starknet → Base directly |
| **LayerSwap** | Third-party | Starknet → Base with USDC support |
| **deBridge** | Already integrated | Check if Starknet support is available/planned |

**Recommended**: Orbiter or LayerSwap for direct Starknet → Base path. Evaluate deBridge Starknet support since we already use their SDK for Solana.

### Phase 3: Wallet + Frontend (1-2 days) ✅ COMPLETE

**Goal**: Users can connect ArgentX or Braavos and complete the full flow.

1. **Wallet connection**
   - Use `starknet.js` + `get-starknet` libraries
   - Add Starknet wallet provider alongside existing wallet providers
   - Add to `src/hooks/useWalletConnection.ts`

2. **Frontend components**
   - Add Starknet option to wallet selector
   - Add chain-specific UI in `src/components/bridge/protocols/`
   - Wire into existing `PurchaseModal` flow
   - Show privacy commitment status (committed → revealed → bridging → purchased)

3. **Address handling**
   - Map Starknet addresses to Base recipient addresses
   - Follow same pattern as NEAR (user provides or derives Base address)

### Phase 4: Demo & Submission (1 day)

**Goal**: Polished submission that scores well on all criteria.

1. **Demo video** (≤3 min) — see script below
2. **Project description** (≤500 words) — see template below
3. **Submit on DoraHacks** with all required links

---

## Demo Video Script (≤3 min)

> **Full demo script with step-by-step instructions. Test this flow in production before recording.**

### Pre-Demo Setup Checklist

- [ ] ArgentX or Braavos wallet installed and funded with testnet ETH + USDC on Starknet Sepolia
- [ ] Wallet connected to Starknet Sepolia (not mainnet)
- [ ] Syndicate app open at `https://syndicate.io` (or localhost:3000 for testing)
- [ ] Screen recording software ready (OBS, Loom, etc.)
- [ ] Browser window sized appropriately (1920x1080 recommended)

---

### Step-by-Step Test Flow

#### 1. Wallet Connection (0:00–0:30)

**Actions:**
1. Navigate to https://syndicate.io (or localhost:3000)
2. Click "Connect Wallet" button
3. **In wallet selector, click "Starknet"** (⚡ icon, blue gradient)
4. ArgentX/Braavos popup should appear — approve connection
5. Verify wallet address shows in the UI

**Verification:**
- [ ] Starknet wallet address displayed (starts with 0x, ~66 chars)
- [ ] "Starknet" shown as connected wallet type
- [ ] No error messages

**Troubleshooting:**
- If wallet not detected: Ensure ArgentX/Braavos is installed and unlocked
- If wrong network: Switch wallet to Starknet Sepolia testnet

---

#### 2. Navigate to Bridge Page (0:30–0:45)

**Actions:**
1. Click "Bridge" in navigation
2. Verify Starknet appears as a source chain option

**Verification:**
- [ ] Bridge page loads with chain selector
- [ ] Starknet card visible (⚡ icon, "ZK-rollup on Ethereum")
- [ ] Shows "ArgentX, Braavos" as supported wallets
- [ ] Shows "Orbiter Bridge, Fast, ~2-5 min" features

---

#### 3. Select Starknet as Source Chain (0:45–1:00)

**Actions:**
1. Click on the Starknet card
2. Verify UI updates to show Starknet-specific flow

**Verification:**
- [ ] Starknet card becomes highlighted/selected
- [ ] Bridge amount input appears
- [ ] Destination chain shows "Base" (fixed)
- [ ] Estimated fees display

---

#### 4. Enter Bridge Amount (1:00–1:20)

**Actions:**
1. Enter amount (e.g., "10" USDC)
2. Click "Continue" or "Bridge"

**Verification:**
- [ ] Amount validated (minimum $5 for Orbiter)
- [ ] Fee estimate shows (~$1-2)
- [ ] Protocol selector shows "Starknet Bridge / Orbiter Finance"

---

#### 5. Bridge Transaction (1:20–2:00)

**Actions:**
1. Review bridge details
2. Click "Bridge with Starknet Bridge" or similar
3. **Wallet popup should appear** — approve the transaction
   - This will be 2 calls: approve USDC + deposit to Orbiter
4. Watch progress bar

**Verification:**
- [ ] Progress bar shows stages: "validating" → "approved" → "sending" → "complete"
- [ ] Transaction hash appears (Starknet explorer link)
- [ ] No errors in console

**Troubleshooting:**
- If "insufficient balance": Ensure wallet has USDC on Starknet Sepolia
- If "insufficient ETH for gas": Fund wallet with testnet ETH from faucet

---

#### 6. Completion (2:00–2:30)

**Actions:**
1. Wait for bridge completion
2. Verify success message

**Verification:**
- [ ] "Bridge Complete!" message shows
- [ ] Amount received on Base displayed
- [ ] USDC balance on Base updated

---

### Recording Script (What to Say)

#### 0:00–0:20 — Hook
> "What if you could buy lottery tickets from any blockchain — without anyone knowing it was you? Syndicate is a live cross-chain lottery platform. Today we're adding Starknet with ZK-private purchases."

### 0:20–0:50 — Problem
- Show existing product: 4 chains already working (Stacks, NEAR, Solana, Base)
- Explain the privacy problem: on-chain lottery purchases are public — everyone can see who's buying and how many tickets

### 0:50–1:40 — Solution Demo
- Connect ArgentX wallet
- Show the privacy commitment flow:
  1. Select ticket count
  2. **Commit** — show that on-chain, only a hash is visible (pull up Starkscan)
  3. **Reveal + Bridge** — funds release to bridge, cross to Base
  4. **Tickets appear** — show on Megapot

### 1:40–2:20 — Technical Deep-Dive
- Show the Cairo contract on Starkscan (deployment link)
- Explain Pedersen commitment: `hash(recipient, ticketCount, salt)` — native to Cairo, no external ZK libraries
- Show the bridge architecture diagram: Starknet → Bridge → AutoPurchaseProxy → Megapot
- Highlight: "This is the same proxy that handles Solana, Stacks, and NEAR — Starknet is the 5th chain"

### 2:20–2:50 — Why It Matters
- Privacy: buyers can't be front-run or socially pressured
- Cross-chain: access from any ecosystem
- Live product: not a hackathon prototype — real users, real lottery

### 2:50–3:00 — CTA
> "Syndicate — private lottery tickets from any chain. Try it at [URL]. GitHub: [repo link]."

---

## Project Description Template (≤500 words)

> **Syndicate: Private Cross-Chain Lottery Tickets via Starknet**
>
> Syndicate is a live cross-chain platform that lets users purchase Megapot lottery tickets from any blockchain. We already support Stacks, NEAR, Solana, and Base. For Re{define}, we added Starknet as a source chain with a privacy-first approach.
>
> **The Problem**: On-chain lottery purchases are fully public. Anyone can see who's buying tickets and how many. This creates front-running risk, social pressure, and removes the anonymity that traditional lotteries provide.
>
> **Our Solution**: A Cairo smart contract (`PrivateTicketCommitment`) deployed on Starknet that uses Pedersen commitments — native to Cairo — to hide buyer identity and ticket count. Users commit a hash of their purchase details, deposit USDC, and later reveal to trigger a cross-chain bridge to Base where tickets are purchased atomically via our existing proxy contract.
>
> **How It Works**:
> 1. User connects ArgentX/Braavos wallet
> 2. Commits `pedersen(recipient, ticketCount, salt)` + deposits USDC on Starknet
> 3. On-chain: only the hash is visible — no one knows who's buying or how many
> 4. User reveals, funds bridge from Starknet → Base via [bridge]
> 5. `MegapotAutoPurchaseProxy` atomically purchases tickets on Megapot
>
> **Privacy Properties**: Buyer anonymity (address inside hash), amount hiding (ticket count inside hash), timing privacy (commit and reveal separated), unlinkability (unique salt per commitment).
>
> **Architecture**: Starknet is integrated as the 5th source chain in our modular `UnifiedBridgeManager`. The same proxy contract on Base that handles Solana (deBridge), Stacks (CCTP), and NEAR (Chain Signatures) now handles Starknet. Zero new infrastructure — just a new bridge protocol and the Cairo privacy contract.
>
> **What's Deployed**: `PrivateTicketCommitment` contract on Starknet [testnet/mainnet] at [ADDRESS].
>
> **Built With**: Cairo, starknet.js, Next.js, Solidity (existing proxy), Foundry.

---

## Effort Estimate

| Phase | Work | Time | Priority |
|-------|------|------|----------|
| Cairo contract | `PrivateTicketCommitment` + tests + deploy | 2-3 days | ⭐ CRITICAL |
| Bridge integration | Protocol impl, UnifiedBridgeManager wiring | 2-3 days | HIGH |
| Wallet + frontend | ArgentX/Braavos connection, UI | 1-2 days | HIGH |
| Demo + submission | Video, description, DoraHacks submit | 1 day | ⭐ CRITICAL |
| **Total** | | **6-9 days** | |

---

## What We Don't Need to Build

- ❌ Lottery contracts — Megapot is external ([docs.megapot.io](https://docs.megapot.io/))
- ❌ Cairo port of SyndicatePool — the pool contract lives on Base (Solidity), Starknet is a source chain only
- ❌ New proxy contract — existing `MegapotAutoPurchaseProxy` already handles any bridged USDC
- ❌ New backend infra — existing Vercel + DB stack works for all chains
- ❌ Full ZK circuit — Pedersen commitments are native to Cairo, no external proving system needed

## What We Do Need to Build

- ✅ `PrivateTicketCommitment` Cairo contract (deployed on Starknet — **submission requirement**)
- ✅ Starknet bridge protocol (`src/services/bridges/protocols/starknet.ts`)
- ✅ Wallet integration (starknet.js + get-starknet)
- ✅ Frontend components for Starknet chain option + privacy commitment UI
- ✅ Demo video (≤3 min)
- ✅ Project description (≤500 words)

---

## File Structure (new files)

```
contracts/
└── starknet/
    ├── Scarb.toml                         # Cairo project config
    └── src/
        ├── lib.cairo                      # Module root
        ├── private_ticket_commitment.cairo # Core contract
        └── tests/
            └── test_commitment.cairo      # Unit tests

src/
├── services/bridges/
│   └── protocols/
│       └── starknet.ts                    # Bridge protocol implementation
├── hooks/
│   └── useStarknetWallet.ts               # Wallet connection hook
└── components/bridge/protocols/
    └── StarknetBridge.tsx                  # Chain-specific UI
```

---

## Open Questions

1. **Which bridge SDK?** — Need to evaluate Orbiter vs LayerSwap vs deBridge Starknet support
2. **Starknet USDC address** — Confirm the USDC contract address on Starknet mainnet/Sepolia
3. **Testnet vs mainnet** — Sepolia for initial deploy; mainnet if bridge liquidity available
4. **Pedersen vs Poseidon** — Cairo supports both natively; Pedersen is more standard but Poseidon is faster. Either works for the commitment scheme.

---

## References

- [Megapot Documentation](https://docs.megapot.io/) — external lottery protocol (Base)
- [Starknet Re{define} Hackathon](https://hackathon.starknet.org/)
- [DoraHacks Submission Page](https://dorahacks.io/hackathon/redefine/detail)
- [Starknet Academy](https://academy.starknet.org/) — Cairo fundamentals
- [Cairo Book](https://book.cairo-lang.org/) — language reference
- [Starknet Docs](https://docs.starknet.io/) — network docs
- [starknet.js](https://www.starknetjs.com/) — JavaScript SDK
- [get-starknet](https://github.com/starknet-io/get-starknet) — wallet discovery
- [StarkGate](https://starkgate.starknet.io/) — official Starknet bridge
- [OpenZeppelin Cairo Contracts](https://github.com/OpenZeppelin/cairo-contracts) — standard library
- [Semaphore](https://semaphore.pse.dev/) — anonymous signaling (curated hackathon idea)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Syndicate system architecture
- [BRIDGES.md](./BRIDGES.md) — existing bridge implementations
