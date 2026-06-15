# MetaMask Smart Accounts Kit x 1Shot x Venice — Demo Script

**Target duration**: 60-90 seconds
**Environment**: Base Sepolia (chain id `84532`) — use Base Sepolia USDC, never mainnet
**Wallet**: Regular MetaMask extension, latest version. Flask is **not** required.
**Required preflight env vars** (already set in `.env.local`):
```
NEXT_PUBLIC_ENABLE_ERC7715_SESSIONS=true
NEXT_PUBLIC_ENABLE_METAMASK_AGENT=true
NEXT_PUBLIC_ENABLE_1SHOT_RELAYER=true
NEXT_PUBLIC_ENABLE_VENICE_ADVISOR=true
VENICE_API_KEY=<your venice key>
```

---

## Pre-Recording Setup (do this once, takes ~5 min)

1. `pnpm dev` from `/Users/udingethe/Dev/syndicate` and open the local URL.
2. Open MetaMask → switch network to **Base Sepolia**.
3. Confirm the wallet has ≥ 5 USDC on Base Sepolia. If not, hit a Base Sepolia USDC faucet (`https://www.alchemy.com/faucets/base-sepolia` works).
4. Pin one tab to `https://sepolia.basescan.org` and another to `https://api.venice.ai/api/v1/chat/completions` documentation (for credibility callouts).
5. Open the app's home page in a third tab, with the dev tools Network tab visible (so you can show the 1Shot JSON-RPC call in flight).

---

## Script

### 0:00 - 0:10 | The Problem
Say:

> Auto-buying lottery tickets is normally a "trust me with your wallet" moment. Users either give a custodial bot their private key, or sign a recurring transaction that's hard to reason about. There's no good way to say "use my yield, cap it at \$5 a week, stop in 30 days, and let me revoke it any time."

### 0:10 - 0:25 | What Syndicate Adds
Say, while opening the **Auto-purchase** modal:

> Syndicate turns that into a real product primitive. We use the **MetaMask Smart Accounts Kit** to grant a tightly scoped **Advanced Permission** — a 7715 delegation with a hard spend cap, a target contract, and an expiry. The principal never leaves the user's wallet; the permission only authorizes buying tickets with a bounded amount of USDC.

### 0:25 - 0:45 | Venice Policy Advisor
Click **Yield autopilot** strategy, then **Suggest a policy**.

Say:

> Before the user signs anything, **Venice AI** suggests the cap, period, and ticket count. Venice runs server-side with privacy settings on — no web search, no scraping — and returns a structured recommendation. The UI applies only reviewable fields.

Show the form fields updating with Venice's recommendation (vault: `spark`, period: `weekly`, spend: e.g. `$3.00`, ticket count: 3).

### 0:45 - 1:00 | MetaMask Smart Accounts Kit Prompt
Click **Approve**.

Say:

> Now the real integration. The app calls `requestExecutionPermissions` on the Smart Accounts Kit. MetaMask opens with a clear **Advanced Permission** prompt — not a transaction signing prompt, not a key export. The user can read the cap, the period, the target, and revoke it later from the MetaMask UI.

Confirm in MetaMask. The modal closes, and a toast appears showing the permission was granted.

### 1:00 - 1:15 | Permissioned Autopilot Panel
Say, scrolling to the **Permissioned Autopilot** panel:

> The policy is persisted client-side with the 7710 `permissionContext` extracted from the grant. From this point on, an executor — the user, the Universal Agent, or a relayer — can call the target function without asking the user to sign again, but only inside the cap.

### 1:15 - 1:30 | 1Shot Relayer Execution (Optional, but recommended)
Click **Execute** on the policy.

Say:

> For the Best Use of 1Shot track, we can route that execution through the 1Shot **Permissionless Relayer** — no API key, no signup. It uses `relayer_send7710Transaction` with the 7710 context that came back from MetaMask.

Show the Network tab: a `POST` to `https://relayer.1shotapi.dev/relayers` with method `relayer_send7710Transaction` and the 7710 `permissionContext` in the body.

### 1:30 - 1:45 | Status Polling
Say, pointing to the status badge flipping from `pending` to `submitted` to `confirmed`:

> 1Shot returns a task id. We poll `relayer_getStatus` and map the numeric status code to a human-readable state — pending, submitted, confirmed, rejected, or reverted. If something goes wrong, we surface a typed error instead of crashing.

### 1:45 - 2:00 | Why It Matters
Say:

> Three things make this defensible. First, the **permission is user-revocable** at any time from the MetaMask UI — there's no agent holding a key. Second, the **cap is enforced at the protocol layer**, not just in our UI. Third, **principal is preserved by design** — the policy is bounded by expected yield, not by the user's deposit. If the agent, the relayer, and the UI all misbehave at once, the user can still only lose the cap.

---

## What To Avoid

- Do not mention Ranger, LI.FI, or other hackathon targets — stay focused on the MetaMask brief.
- Do not switch to a "Coming Soon" tab. If a flow breaks, use the backup line below.
- Do not show a 1Shot API key in the recording. The public endpoint requires none.
- Do not navigate to the explorer mid-flow unless the receipt is clean and the timing is right.

## Backup Line If Something Breaks

> The architecture is: a real `@metamask/smart-accounts-kit` permission grant, a real 1Shot relayer call, and a real Venice advisor — all wired into our existing auto-purchase modal. Even if the live demo hits a network blip, the code map in `docs/METAMASK_COOKOFF_SUBMISSION.md` is line-anchored to the actual implementation.

## Recording Tips

- Use a 1920x1080 capture region, browser zoom at 100%, dark mode on.
- Pre-type the USDC amount in the modal so the keystrokes don't eat your time budget.
- Do a dry run first to find the exact transition between MetaMask prompt and the toast. That single cut is the difference between a slick 75s video and a 2-minute one.
- If you want to overlay the 1Shot JSON-RPC call, screen-record the dev tools Network tab on a second monitor and crop it in post.
