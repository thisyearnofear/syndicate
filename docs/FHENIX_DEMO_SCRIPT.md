# Fhenix Demo Script

## Goal
Show one clean privacy-native user journey:
1. deposit into a Fhenix-enabled vault
2. show that the amount is not exposed as a normal public balance flow
3. reveal the private balance only for the authorized user

Target duration: **2 minutes**

---

## Demo Setup

Before recording or presenting:
- ensure the app is pointed at the correct Fhenix-enabled chain
- ensure `NEXT_PUBLIC_FHENIX_VAULT_ADDRESS` is set
- use a wallet/account with a completed Fhenix deposit
- preload the Yield Dashboard page
- keep one explorer tab ready for the transaction if you want to show receipt metadata

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

### 1:15 - 1:45 | Selective Disclosure
Go to the Fhenix vault row in the Yield Dashboard and click **Reveal Private Balance**.

Say:

> Now we request and activate a permit, fetch the encrypted balance ciphertext hash from the vault, and unseal it locally in the browser. Only the authorized user can reveal this value.

Pause long enough for the balance to appear.

Then say:

> So the position stays private by default on-chain, but still remains usable for the account owner.

### 1:45 - 2:00 | Why It Matters
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
- do not show withdrawal unless you are fully ready to defend the implementation

---

## Backup Line If Something Breaks

> The core idea is unchanged: encrypted deposit, private on-chain state, and selective client-side disclosure through permits. Even if the demo environment is flaky, that is the implemented architecture we’ve integrated into the product.

