# Build X — AI Season Hackathon Package

**Prepared 2026-08-11. Deadline: 2026-08-21 23:59 UTC (10 days).** Official page: <https://web3.okx.com/xlayer/build-x-series>

This document is the single source for our entry: what we're submitting, the narrative, the compliance checklist, and the asset plan. It doubles as the text source for the Google Form.

---

## 1. The opportunity, as we read it

- ~300k USDT total. **Our target: the Hackathon Grant tier (30k / 15k / 5k USDT)** — judged on AI application, product completeness, user value, X Layer integration, ecosystem contribution, on-chain data.
- **Not pursuing — on principle:**
  - *Launch Grant (up to 200k)*: requires ≥$10M trading volume through the OKX DEX interface by 2026-08-31. That is a token/DEX-volume funnel; chasing it would contradict our no-token, no-wash-trading positioning and our published honesty rules.
  - *Liquidity Grant (50k)*: restricted to the AI-RWA track — not our product.

## 2. Positioning (three sentences max for judges)

**Syndicate is the first no-loss lottery with an AI agent as treasurer.** The agent loops over a Uniswap v4 prize-pool hook on X Layer testnet — swap surcharges fund the pot, principal stays redeemable — and every claim it makes about money movement is verified against on-chain receipts before it is reported. Underneath, the same product on Base (Megapot) is live with the same honesty contract: pending is never success, and the UI says so.

Judging-criteria mapping:

| Criterion | Our evidence |
|---|---|
| AI application | Agent loop with a tool registry, HITL gating on draw execution, and persisted task memory (`src/services/agents/tools/`, `/xlayer` agent panel) — not a chat wrapper |
| X Layer integration | 5 contracts live on testnet 1952 since 2026-08-09 (table in `docs/X_LAYER.md`); write paths gated and receipt-verified |
| Product completeness | Shared design system (`docs/DESIGN.md`), reveal grammar, receipt-moment ceremonies, state grammar; Base product live today |
| User value | No-loss mechanics; drawings funded by surcharges/yield, principal redeemable |
| Innovation | "The DEX is the lottery": prize pool funded by trading surcharges inside the DEX router, not a side contract |
| Ecosystem contribution | Public repo, operator runbooks, and the randomness design (Section 3) usable by every future lottery on X Layer |

## 3. Randomness story (the question judges will probe)

Chainlink VRF and Pyth Entropy are **not available on X Layer** (verified 2026-08-11 against the Pyth chain registry and Chainlink announcements). Therefore:

- **Testnet (today):** disclosed demo oracle (`SimpleRandomnessOracle`, operator-controlled), clearly labeled in-product.
- **Production design:** drand (League of Entropy) beacon + permissionless relay — threshold-signed rounds, publicly reproducible winner math, replay protection. **EIP-2537 (BLS12-381) precompiles verified present on X Layer testnet 1952 via calibrated probe on 2026-08-11**, so full on-chain verification of drand signatures is available on the primary path; a bonded-relay challenge window remains the documented fallback for mainnet 196 (to be probed identically pre-launch). Full design: `docs/X_LAYER.md#randomness-decision`.
- **Gate:** mainnet launch requires either precompile-verified drand or independent review of the bonded-relay design. We will not ship the demo oracle to real value.

This is a *feature* of the submission: we've already done the work other lottery projects defer, and X Layer benefits from a documented randomness path.

## 4. Compliance matrix (all must be green by 2026-08-21)

| Requirement | Status | Action | Owner |
|---|---|---|---|
| AI elements incorporated | ✅ Done | — | — |
| Deployed on X Layer testnet | ✅ Done (2026-08-09, 5 contracts) | Refresh demo walkthrough data | us |
| Launch on X Layer Mainnet (subsequently) | 🟡 Designed | Randomness design doc (done); EIP-2537 probe on testnet 1952 ✅ (done 2026-08-11, precompiles present); mainnet-196 probe + implementation plan post-deadline | us |
| Dedicated X account | 🔴 Missing | Create `@SyndicateApp` (or alt handle below); bio + 3 seed posts | user |
| Post mentioning @XLayerOfficial | 🔴 Missing | Launch post (draft in Section 6) | user |
| Google Form submission | 🔴 Missing | Submit with Section 5 text; note **potential KYC for prizes** | user |

## 5. Google Form — draft answers

**Project name:** Syndicate
**Tagline:** No-loss prize pools with an AI agent treasurer — receipts verify everything.
**Description:**
> Syndicate runs no-loss prize pools on X Layer: a Uniswap v4 hook withholds a small trading surcharge into a prize pot, depositor shares set draw odds, and principal is redeemable between draws. An AI agent acts as treasurer — it proposes and executes draw operations through a permissioned tool registry with human-in-the-loop gating, persisted task memory, and explicit failure states. The product never reports money movement as complete without a verified on-chain receipt, and its design system (reveal grammar, receipt ceremonies) is built around that honesty contract. Live on X Layer testnet (5 contracts) with a demo loop, and on Base mainnet via Megapot for the core product.
**AI elements:** autonomous agent loop (tool registry + HITL gating + persistent memory) executing on-chain draw operations; operator runbooks; audit-logged actions.
**Links:** repo <https://github.com/thisyearnofear/syndicate>, app <https://syndicateapp.vercel.app/xlayer>, docs <https://github.com/thisyearnofear/syndicate/blob/main/docs/X_LAYER.md>, testnet contracts (table in doc).
**Track:** AI + Consumer/Gaming (noless-lottery). Explicitly not AI-RWA.

## 6. X account starter pack

Handle candidates: `@SyndicateApp` (preferred), `@SyndicateBase`, `@syndicate_xyz`.

**Bio:** No-loss lottery on Base + X Layer. AI agent treasurer. Your principal back, always. Receipts, not promises. syndicateapp.vercel.app

**Launch post (also satisfies the @XLayerOfficial mention):**
> We built a prize pool hook for @XLayerOfficial where an AI agent acts as treasurer and every claim it makes is verified on-chain before you see it. No-loss by design: deposit, win the pot, principal always redeemable. Live on X Layer testnet → [app link] 🧵

**Thread (3 posts):** 1/ the mechanic (surcharge → pot → weighteds draw); 2/ the agent (tools, HITL, memory, audit log); 3/ the honesty contract (receipt verification, explicit failure states, no demo-oracle-to-mainnet).

## 7. Demo video — shot list (≤3 min, no voiceover required)

| # | Shot | Duration | Caption |
|---|---|---|---|
| 1 | Landing hero — orb active, jackpot count-up | 5s | "No-loss lottery. Live on Base." |
| 2 | /xlayer dashboard: PoolManager state, pot balance | 8s | "On X Layer testnet." |
| 3 | Agent panel loop: tool dispatch, HITL prompt, draw executed, outcome | 20s | "The AI agent is the treasurer." |
| 4 | Deposit → receipt ceremony (emerald beam receipt) | 8s | "Money movement is receipt-verified." |
| 5 | Draw-resolve moment: orb flicker → emerald settle → winner strip | 12s | "No refresh. It resolves live." |
| 6 | Code slide: `IRandomnessOracle` + drand design excerpt | 8s | "Randomness designed, not deferred." |

Recording: Loom or ffmpeg+QuickTime; keep 60fps if possible. If the demo loop isn't cooperating, record the testnet block-explorer trail instead — honesty over polish.

## 8. Timeline (owner-tagged backwards from deadline)

- **Aug 11 (today):** randomness design doc ✅ (this commit); EIP-2537 precompile probe on 1952 ✅ (precompiles present — primary path confirmed); package doc ✅.
- **Aug 12–14:** agent-loop polish ✅ (shipped 2026-08-11 in `b06dde3`: Steps|Transcript tabs, persisted audit transcript, `agent.*` observability events, full rationale + warnings, gate chips, explorer receipt links); record demo video v1.
- **Aug 15–16:** X account creation + 3 seed posts; cut final video; screenshots.
- **Aug 17–18:** internal review against judging criteria; fill Google Form draft offline once more; fix highest-signal gaps only.
- **Aug 19–20:** final QA pass; rehearse answers for judge Q&A (randomness, custody, failure modes).
- **Aug 21:** submit before 23:59 UTC; post the launch thread after submission (or the day before to show activity).

## 9. Risks and honest mitigations

| Risk | Mitigation |
|---|---|
| "Subsequently launched on mainnet" construed as hard pre-award deadline | Present the randomness design + gate honestly in the form and thread; plan mainnet for immediately post-AI-Season; judges historically accept credible mainnet paths for testnet-season hackathons |
| Small team shipping surface | Lean into it: the restraint is the pitch (one product thesis executed consistently) |
| Judges expecting tokenomics | Explain Launch Grant opt-out explicitly in the thread — principled opt-out reads as integrity, not weakness |
| Demo fragility during judging | Video + screenshots + on-chain testnet history as backup evidence |
