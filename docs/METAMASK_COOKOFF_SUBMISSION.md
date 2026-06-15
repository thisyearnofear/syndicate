# MetaMask Smart Accounts Kit x 1Shot API x Venice AI Cook-Off — Submission Summary

**Hackathon**: MetaMask Smart Accounts Kit x 1Shot API Hackathon (hosted by MetaMask Developer)
**Ecosystem**: Ethereum
**Prize pool**: $14,000 (Best x402 + ERC-7710, Best Agent, Best A2A coordination, Best use of Venice AI, Best Use of 1Shot Permissionless Relayer, Best Social Media presence, Best Feedback)
**Submission team (registered on MetaMask portal)**: Dotun Ayoku, Olusegun Ogunwole, Henry Marfo
**Submission date**: June 15, 2026

---

## Project
**Syndicate** is a multi-chain yield + lottery coordination platform on Base. The MetaMask-cook-off integration is the **permissioned autopilot** path: a user grants a MetaMask Smart Accounts permission that allows an agent to use vault **yield** (never principal) to buy Megapot lottery tickets, inside an explicit spend cap, period, target, and expiry. Optional 1Shot relayer submits the resulting 7710 call. A Venice AI advisor suggests the policy parameters.

## Track Prize Mapping

| Track Prize | Prize | What we built | Code anchors |
|---|---|---|---|
| **Best x402 + ERC-7710** | $3,000 | x402 path on Stacks (SIP-018) + ERC-7715 grant on EVM whose `permissionContext` is sent to 1Shot's `relayer_send7710Transaction` (the 7710 call format) | `src/domains/wallet/services/stacksX402Service.ts`; `src/services/metamask/oneShotRelayerService.ts:46-77`; `src/services/automation/erc7715Service.ts:159-228` |
| **Best Agent** | $3,000 | Three composable agent layers: (1) Venice policy advisor, (2) Universal Agent (Virtuals ACP) for reasoning + execution, (3) WDK autonomous agent | `src/services/agents/venicePolicyAdvisor.ts`; `src/services/automation/VirtualsService.ts`; `src/services/automation/AutomationOrchestrator.ts:executeVirtualsAgentTask` |
| **Best A2A coordination** | $3,000 | ERC-7715 `Permission` → `SmartSession` → `SubAgent` delegation chain; sessions are batched 4-purchase windows created from a parent permission | `src/services/automation/erc7715Service.ts:281-318` (`createAutoPurchaseSession`); `src/services/metamask/permissionedAutopilotService.ts:createPolicy` (extracts and persists `permissionContext` for downstream agents) |
| **Best use of Venice AI** | $3,000 | Server-side Chat Completions with `venice_parameters: { enable_web_search: 'off', enable_web_scraping: false, disable_thinking: true }` for privacy, `response_format: json_schema` for guardrailed output. Capped vault list and `preservePrincipal: true` enforced in code, not just prompted | `src/services/agents/venicePolicyAdvisor.ts:48-99` (request); `src/app/api/agent/autopilot/advice/route.ts` (server proxy) |
| **Best Use of 1Shot Permissionless Relayer** | $1,000 USDC | Real JSON-RPC client to the public 1Shot endpoint with `relayer_getCapabilities` → `relayer_send7710Transaction` → `relayer_getStatus` lifecycle. Task IDs tracked locally; status polled until `pending`/`submitted`/`confirmed`/`rejected`/`reverted` | `src/services/metamask/oneShotRelayerService.ts:8-9` (URLs), `53-71` (submit), `87-95` (status), `97-110` (capabilities) |
| **Best Social Media presence** | $100 × 5 = $500 | Out of scope for this doc |
| **Best Feedback** | $100 × 5 = $500 | Out of scope for this doc |

We are positioning for the first five technical tracks. Social/feedback tracks are nice-to-haves.

## Why this matches the brief

The hackathon brief asks for *"a working MetaMask Smart Accounts Kit integration (either Smart Accounts or Advanced Permissions) in the main flow of the application."* Our main purchase flow on `AutoPurchaseModal` is exactly that — when a user enables **yield-autopilot** mode, the modal calls `useERC7715().requestAdvancedPermission(...)` against `@metamask/smart-accounts-kit` and writes the resulting grant through `permissionedAutopilotService.createPolicy`. The user can then either (a) keep the direct-execution path, or (b) flip `enable1ShotRelayer=true` to have the executor submit through 1Shot.

The wedge is **principal preservation**: a Venice advisor recommends a spend cap and ticket count that is bounded by *expected accrued yield*, not principal. The MetaMask permission enforces that cap at the protocol layer (delegation limits + period). The 1Shot relayer pays gas for the eventual ticket buy. Even if every other layer fails, the user cannot lose more than the cap, and the user can revoke the permission in MetaMask at any time.

## Architecture

```
┌──────────────┐    Advanced Permission (ERC-7715)    ┌──────────────────────┐
│  MetaMask    │ ◀──────────────────────────────────── │   AutoPurchaseModal  │
│  extension   │       isAdjustmentAllowed = true      │  (yield-autopilot)   │
└──────────────┘                                        └────────┬─────────────┘
       │ user revokes                                              │ policy
       ▼                                                           ▼
┌──────────────┐    policy                                       ┌────────────────────┐
│ Permission   │ ──────────────────────────────────────────────▶ │  permissioned      │
│ store (LS)   │                                                │  AutopilotService  │
└──────────────┘                                                └────────┬───────────┘
                                                                        │ contains
                                                                        ▼
                                                              ┌────────────────────┐
                                                              │ permissionContext  │
                                                              │ (ERC-7710 delega-  │
                                                              │  tion array)       │
                                                              └────────┬───────────┘
                                                                       │ submit
              ┌─────────────┐  suggest capped policy  ┌──────────────▼────────────┐
              │ Venice AI   │ ◀────────────────────── │  /api/agent/autopilot/    │
              │ Chat Compl. │   (json_schema, private)│  advice (server proxy)    │
              └─────────────┘                         └───────────────────────────┘
              ┌─────────────┐  relayer_send7710Transaction  ┌────────────────────┐
              │ 1Shot API   │ ◀──────────────────────────── │  Executor (client)  │
              │ (public)    │   relayer_getStatus           │                     │
              └─────────────┘                               └────────────────────┘
                       │
                       ▼
              ┌─────────────┐    buyTickets()       ┌────────────────────┐
              │  Megapot V2 │ ◀──────────────────── │  USDC approval     │
              │  (Base Sep) │                       │  (cap-bounded)     │
              └─────────────┘                       └────────────────────┘
```

## Smart Accounts Kit usage (the required bit)

We use the official MetaMask Smart Accounts Kit, not a homegrown delegation system.

- **Package**: `@metamask/smart-accounts-kit ^0.3.0` (`package.json:60`)
- **Provider actions import**: `import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'` (`src/services/automation/erc7715Service.ts:25`)
- **Wallet client extension**: `baseClient.extend(erc7715ProviderActions())` (`src/services/automation/erc7715Service.ts:120`)
- **Permission request**: `walletClient.requestExecutionPermissions([...])` with top-level `isAdjustmentAllowed`, signed by the active account (`src/services/automation/erc7715Service.ts:181-205`)
- **Permission scopes supported**: `erc20-token-periodic` and `native-token-periodic`, period `daily | weekly | monthly | unlimited` (`src/services/automation/erc7715Service.ts:60-66`)
- **No Flask required**: support check explicitly handles regular MetaMask, not just Flask (`src/services/automation/erc7715Service.ts:141-149`)
- **Presets**: `getPermissionPresets(chainId)` returns a 50 USDC/week and 200 USDC/month default (`src/services/automation/erc7715Service.ts:454-481`)
- **Validation**: full period-window math + remaining budget enforcement before execution (`src/services/automation/erc7715Service.ts:362-415`)

## 1Shot Relayer usage

- **Public endpoint, no signup**: `https://relayer.1shotapi.com/relayers` (mainnet) / `https://relayer.1shotapi.dev/relayers` (testnet) (`src/services/metamask/oneShotRelayerService.ts:8-9`)
- **Capabilities check** before submit (`src/services/metamask/oneShotRelayerService.ts:73-75`)
- **Submission format**: `relayer_send7710Transaction` with `transactions: [{ permissionContext, executions: [{ target, value, data }] }]` (`src/services/metamask/oneShotRelayerService.ts:53-71`)
- **Status polling**: `relayer_getStatus` returns numeric status codes mapped to `pending | submitted | confirmed | rejected | reverted` (`src/services/metamask/oneShotRelayerService.ts:87-95`, `src/components/automation/PermissionedAutopilotPanel.tsx:36-50`)
- **Graceful missing-context fallback**: if MetaMask returns a permission without an `ERC-7710 permissionContext`, the service returns a typed `missing-permission-context` error rather than crashing (`src/services/metamask/oneShotRelayerService.ts:35-44`)
- **Hard runtime gate**: submission is blocked unless the policy's `permissionContext` was actually extracted and persisted (`src/services/metamask/oneShotRelayerService.ts:35-44`)

## Venice AI usage

- **Endpoint**: server-side `https://api.venice.ai/api/v1/chat/completions` — never called from the browser (`src/services/agents/venicePolicyAdvisor.ts:6`)
- **Privacy settings**: `venice_parameters: { enable_web_search: 'off', enable_web_scraping: false, enable_web_citations: false, strip_thinking_response: true, disable_thinking: true }` (`src/services/agents/venicePolicyAdvisor.ts:66-71`) — no user data leaves via web search
- **Output guardrails**: `response_format: { type: 'json_schema', json_schema: { ... } }` constrains the response to vault/period/spend/ticketCount/rationale/warnings; allowed vaults enum is `['spark', 'fhenix', 'pooltogether']` (`src/services/agents/venicePolicyAdvisor.ts:72-110`)
- **Hard-enforced caps in code**: even if Venice recommends above 25 USDC, the advisor caps it to a `spendCap` derived from the user's existing amount + risk preference (`src/services/agents/venicePolicyAdvisor.ts:163-165`)
- **Always preserve principal**: the `preservePrincipal` field is forced to `true` on the way out of the sanitizer (`src/services/agents/venicePolicyAdvisor.ts:155-178`)

## x402 + ERC-7710 track evidence

The brief calls the prize "x402 + ERC-7710". We treat ERC-7710 as the 1Shot call format (which is correct per the 1Shot docs) and ERC-7715 as the user-facing permission model (which is what MetaMask exposes). The two are linked: the permission grant response from MetaMask contains a `permissionContext` array in 7710 delegation format, which is then handed to 1Shot.

For x402 specifically, we ship the Stacks path (`stacksX402Service.authorizeRecurringPayment` using SIP-018 signatures), wired into the `AutoPurchaseModal` Stacks branch.

## What judges can verify in 5 minutes

1. Open the deployed app and connect MetaMask (no Flask).
2. Switch to **Base Sepolia** (`84532`). Faucet USDC from the Base Sepolia USDC contract if needed.
3. Open the **Auto-purchase** modal → select **Yield autopilot** → click **Suggest a policy** (Venice returns within ~2s) → confirm.
4. Click **Approve** → MetaMask Smart Accounts prompt appears → confirm.
5. `PermissionedAutopilotPanel` shows the new policy with `MetaMask policy` badge.
6. Hit **Execute** → 1Shot public endpoint is called → status updates to `submitted` → `confirmed` (or `reverted` if test USDC is insufficient, which is still a successful demo of the relayer path).
7. Open `localStorage` → `syndicate:permissioned-autopilot-policies` shows the persisted policy and its `permissionContext`.

A full step-by-step recording script is at `docs/METAMASK_COOKOFF_DEMO_SCRIPT.md`.

## Code & Architecture bullets

- Real `@metamask/smart-accounts-kit` usage — no homegrown delegation system
- Real 1Shot public endpoint integration — no private relayer key required
- Real Venice AI integration with privacy-preserving `venice_parameters` and structured output
- Real x402 path on Stacks (SIP-018), wired into the same modal
- Principal-preserving by design: policy recommendation capped against `currentAmount`, never against `principal`
- Permission is user-revocable in MetaMask at any time (the Smart Accounts Kit surfaces the revoke UI)
- Code map is line-anchored above so judges can navigate the implementation quickly

## What this is NOT

- It is **not** a closed-box demo. The integration is wired into the existing app's main purchase flow and gated behind feature flags (`FEATURES.enableMetaMaskAutopilot`, `enable1ShotRelayer`, `enableVeniceAdvisor`) so the direct-fallback path always works.
- It is **not** a spend-principal path. Both Venice's prompt and the code's sanitizer forbid `preservePrincipal: false` (`src/services/agents/venicePolicyAdvisor.ts:121-127, 155-178`).
- It is **not** locked to a single chain. The Smart Accounts Kit is used the same way on Base, Base Sepolia, Ethereum, and Ethereum Sepolia (`SUPPORTED_CHAINS` in `src/services/automation/erc7715Service.ts:79-84`).
