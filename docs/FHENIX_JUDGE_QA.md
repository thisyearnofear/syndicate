# Fhenix Judge Q&A

## Recommended Positioning

Use this framing consistently:

> Syndicate is a multi-chain yield and pooling platform. Our Fhenix integration adds a privacy-native vault path where user contribution amounts and positions remain encrypted on-chain, while authorized users can selectively reveal balances client-side through permits.

Keep the story anchored to:
- privacy-by-design
- encrypted state
- selective disclosure
- product-native integration

Do not broaden the story unless asked.

---

## Strong Short Answers

### What did you actually build with Fhenix?
We implemented a privacy-native vault flow inside our existing app. Users can deposit through an encrypted path, and authorized users can reveal private balances locally using permits. We also integrated that path into our dashboard UX and backend verification flow.

### Why use Fhenix instead of normal access control?
Normal access control does not solve on-chain data exposure. We need computation on encrypted state, not just gated frontend views. Fhenix lets us preserve confidentiality during contract execution itself.

### What is private in your system?
The key private value is the user’s contribution or vault position amount. That value is encrypted in the Fhenix-enabled path and only revealed to an authorized user through a permit-based client-side unseal flow.

### What is still public?
Transaction existence, contract interaction, and some non-sensitive metadata may still be observable. The goal is not to hide that activity happened, but to keep the sensitive numeric state confidential.

### Is this a standalone demo or integrated into your real product?
It is integrated into our real product architecture. We extended existing vault and syndicate flows, shared services, API verification, and dashboard UI rather than building a separate hackathon-only stack.

### What is the user-facing privacy moment?
The clearest one is the “Reveal Private Balance” flow. The position is private by default, then the authorized user requests a permit and reveals the exact value locally.

---

## Harder Technical Questions

### How does the reveal flow work?
At a high level:
1. the user has a Fhenix-enabled encrypted position
2. the client initializes the FHE SDK
3. the user creates or activates a permit
4. the app requests the encrypted balance ciphertext hash from the contract
5. the client unseals the value locally for the authorized user

### Where is the value decrypted?
On the client side for the authorized user, after the permit flow. The sensitive value is not treated as a normal transparent on-chain balance.

### How did you integrate this without creating a parallel stack?
We followed enhancement-first principles. We extended existing provider, hook, and dashboard layers. Shared Fhenix actions live in one place, and the SDK wrapper is centralized so the privacy path remains modular and maintainable.

### What architectural choices are you proud of?
- extending existing abstractions instead of duplicating product surfaces
- keeping FHE SDK access centralized
- making the privacy win visible in UI, not just in contract code
- separating chain config, actions, and permit/unseal logic cleanly

---

## Sensitive Questions You Should Answer Carefully

### Is this production-ready today?
Recommended answer:

> The privacy-native deposit and selective disclosure flow are real and integrated today. We are being deliberate about security hardening and treat production readiness as a separate bar from buildathon completeness.

### How do you guarantee withdrawal correctness against encrypted balances?
If this is not fully hardened yet, use an honest answer:

> Our strongest completed path today is encrypted deposit plus selective disclosure. Withdrawal correctness is the main security-critical hardening step we identified next, and we prefer to be explicit about that rather than overclaim readiness.

Do not improvise here.

### Why should judges care if the system is not fully production-hardened?
Because the implementation demonstrates the right architectural move: privacy as a first-class primitive inside a real product stack. The buildathon is about applying encrypted compute meaningfully, and this shows a concrete path to privacy-native financial coordination.

---

## What Not To Say

Avoid:
- “It’s basically production-ready” if material security hardening remains
- “We also do lots of other things” as the first answer to every question
- “Privacy is just a better UX” without describing encrypted on-chain state
- “We hid everything” because some metadata is still public

---

## If A Judge Pushes On Scope

Recommended answer:

> We intentionally focused on one strong privacy-native flow instead of spreading effort across many partial ideas. Our goal was to show a meaningful, product-integrated use of encrypted state that can expand into broader confidential coordination over time.

---

## Closing Answer

If asked why this matters, end with:

> Transparent rails limit what financial coordination can happen safely on-chain. We are using Fhenix to make confidentiality part of the product architecture itself, which opens the door to private balances, private participation, and selective disclosure without moving away from on-chain execution.

