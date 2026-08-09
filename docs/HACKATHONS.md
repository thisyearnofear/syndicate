# Hackathons and Submissions

This file is an index, not a second product strategy. Current implementation status lives in [`AGENTS.md`](../AGENTS.md); detailed protocols live in the canonical guides.

## Active focus

### OKX X Layer Build X — AI Season

- **Project:** Prize Pool Hook — trading-fee-funded weighted lottery on X Layer.
- **Status:** Testnet deployed on chain 1952 (hook + router + demo oracle against faucet USDC_TEST); `/xlayer` reads wired; write flows and AI keeper still pending.
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
