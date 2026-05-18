# Fhenix Demo Script

## Goal
Show one clean privacy-native user journey:
1. deposit into a Fhenix-enabled vault
2. show that the amount is not exposed as a normal public balance flow
3. reveal the private balance only for the authorized user

Target duration: **2–3 minutes**

---

## Demo Setup

Before recording or presenting:
- ensure the app is pointed at the correct Fhenix-enabled chain
- ensure `NEXT_PUBLIC_FHENIX_VAULT_ADDRESS` is set
- use a wallet/account with a completed Fhenix deposit
- preload the Yield Dashboard page
- keep one explorer tab ready for the transaction if you want to show receipt metadata
- ensure APY oracle is set (coordinator calls `setApy(500)` for 5.0% APY)

---

## Script

### 0:00 - 0:20 | Problem
Say:

> Most on-chain financial apps expose too much by default. Position size, contribution amounts, and user behavior become public immediately. For privacy-sensitive coordination, that is a hard product limitation.

### 0:20 - 0:45 | What We Added
Show the Fhenix-enabled vault flow.

Say:

> We integrated Fhenix directly into Syndicate so deposits can be encrypted client-side, computed on encrypted state on-chain, and only selectively revealed to the authorized user.

### 0:45 - 1:15 | Encrypted Deposit
If you are doing the deposit live:
- initiate a Fhenix vault deposit
- confirm the transaction
- briefly point out that the user still completes a normal wallet interaction, but the sensitive amount is handled through the encrypted path

Say:

> This deposit uses our Fhenix vault flow. The amount is encrypted client-side and submitted through `depositEncrypted(...)`, so the confidential value is not exposed through a normal transparent balance pattern.

If you are not doing the deposit live:
- reference a recently completed Fhenix deposit already visible in the app

### 1:15 - 1:45 | Selective Disclosure (Sealed Output)
Go to the Fhenix vault row in the Yield Dashboard and click **Reveal Private Balance**.

Say:

> Now we request and activate a permit, and fetch the balance as a sealed output from the contract — re-encrypted for the user's key via `FHE.sealoutput()`. The browser decrypts it locally using the active permit, without any threshold network round-trip.

Pause long enough for the balance to appear.

Then say:

> So the position stays private by default on-chain, but still remains usable for the account owner — the contract re-encrypts the value for the requesting user at view-call time.

### 1:45 - 2:15 | APY Oracle (Optional)
If time permits and APY is set, point to the Fhenix vault row showing the live APY.

Say:

> The vault has an on-chain APY oracle. The coordinator sets the rate in basis points directly on the contract, and the provider reads it with a fallback chain — so the Yield Dashboard always displays the current rate alongside other strategies.

### 2:15 - 2:30 | Withdrawal Security (Optional)
If asked about withdrawal flow:

> Withdrawals require a coordinator-signed EIP-712 attestation. The coordinator can decrypt the balance off-chain, then signs `(member, amount, nonce)`. The contract verifies the signature and prevents replay attacks. This replaces raw amount trust with cryptographic proof.

### 2:30 - 2:45 | Why It Matters
Say:

> This turns privacy into a first-class primitive inside our existing product. We are not building a separate demo stack. We extended real vault, API, and dashboard flows so confidential balances and participation can become native product behavior.

---

## Optional Explorer Callout
If useful, say:

> You can see the transaction occurred, but the sensitive amount is not displayed as an ordinary transparent balance flow. The user only sees the exact value after the permit-based reveal.

Do not over-explain this unless the explorer evidence is clean and easy to interpret.

---

## What To Avoid In The Demo
- do not jump between too many unrelated product areas
- do not lead with bridge or non-Fhenix features
- do not emphasize unfinished production-hardening work

---

## Backup Line If Something Breaks

> The core idea is unchanged: encrypted deposit, private on-chain state, and selective client-side disclosure through permits. Even if the demo environment is flaky, that is the implemented architecture we’ve integrated into the product.

