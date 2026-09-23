# Hackathons and Submissions

This file is an index, not a second product strategy. Current implementation status lives in [`AGENTS.md`](../AGENTS.md); detailed protocols live in the canonical guides.

## Active focus

### OKX Dev Day 2026 — Build a Company track

- **Project:** X Layer ticket rail — Megapot entries for OKX agents, paid in USD₮0 on X Layer via x402, listed on OKX.AI as an A2MCP service.
- **Status:** Planned (2026-09-23). Nothing OKX-specific shipped in the build window before this; the rail, endpoint, and listing are the in-window work.
- **Deadline:** 2026-09-25 23:59 UTC. OKX.AI listing review takes up to 24h.
- **Canonical guide:** [`OKX_DEV_DAY.md`](OKX_DEV_DAY.md).

## Closed (outcome not recorded here)

### Inco Summer Game Jam — Megapot track

- **Project:** Season of Tickets / The Tontine Pot — crews pooling real Megapot entries, tontine seat dynamics, and an open call-the-pot auction; every score a real on-chain entry.
- **Status:** Implemented and E2E-verified on Base Sepolia (real on-chain purchases + receipt-verified settlement; full game loop re-run 2026-08-14 including auction dynamics, tontine renormalization, scoring, and keeper). Dedicated Base mainnet wallet funded; two real mainnet purchases completed via `RandomTicketBuyer.buyTickets` on 2026-08-14; mainnet receipt-verified settle completed 2026-08-14 (live V2 event decoding added). Jam rules confirmed: a testnet prototype is a compliant submission. Build window 2026-07-29 → 2026-08-14.
- **Demo video:** 60s "The Last Seat Wins" kinetic-type reel — real `/season` UI plates, real mainnet stats (2 purchases · 3 tickets · 3 USDC chest), auction to 33.3%, receipt stamps (`0x543995da…09ef5c`, `0xbac9941a…72f4`), settlement reveal. Source + poster: [`videos/season-of-tickets-demo/`](../videos/season-of-tickets-demo/index.html); rendered MP4 at `videos/season-of-tickets-demo/renders/season-of-tickets-demo.mp4` (not committed).
- **Canonical guide:** [`SEASON.md`](SEASON.md).

### OKX X Layer Build X — AI Season

- **Project:** Prize Pool Hook — trading-fee-funded weighted lottery on X Layer.
- **Status:** Closed 2026-08-21. Testnet deployed on chain 1952; `/xlayer` agent loop (tool registry, HITL, receipts, session memory); deposit writes still capability-gated. As of 2026-09-23 the pool's only participant is the operator keeper (self-play).
- **Canonical guide:** [`X_LAYER.md`](X_LAYER.md).

### MetaMask / 1Shot / Venice

- **Project:** permissioned, yield-funded lottery autopilot.
- **Status:** implementation shipped in the existing automation and purchase flows.
- **Canonical code map:** `src/services/metamask/`, `src/services/automation/`, `src/components/automation/`.
- **Historical submission packet:** [`archive/METAMASK_COOKOFF_SUBMISSION.md`](archive/METAMASK_COOKOFF_SUBMISSION.md).

## Completed or historical

- **Fhenix Privacy Buildathon:** integration shipped; see [`FHENIX.md`](FHENIX.md).
- **Ranger Build-a-Bear:** historical strategy; preserved in [`archive/RANGER_HACKATHON_STRATEGY.md`](archive/RANGER_HACKATHON_STRATEGY.md).
- **LI.FI / other planning:** preserved in `docs/archive/` when useful; not current roadmap commitments.

## Submission hygiene

Before submitting any hackathon artifact, verify:

1. the implementation status in `AGENTS.md`;
2. deployed addresses and network claims;
3. the current security/randomness limitations;
4. that demo-only infrastructure is clearly labeled.
