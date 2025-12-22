# Stacks-to-Megapot Bridge System

**Status**: ✅ Production Ready (V3 Multi-Token Bridge)  
**Contract Deployed**: `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3`  
**Last Updated**: December 22, 2025

## Overview

A trustless bridge system enabling Stacks users to participate in Megapot lottery on Base without needing a Base wallet. Users pay with supported Stacks tokens (USDC, aeUSDC, or sUSDT), and the bridge operator handles cross-chain execution transparently.

### Architecture Principles ✨

Built following our core principles:
- **ENHANCEMENT FIRST**: Extends existing bridge infrastructure
- **DRY**: Reuses viem, status tracking, event patterns
- **CLEAN**: Clear separation between on-chain (Clarity) and off-chain (operator)
- **MODULAR**: Each component is independent and testable
- **PERFORMANT**: Efficient polling, retry logic, health monitoring

## System Components

### 1. Stacks Smart Contract ✅
**File**: `contracts/stacks-lottery-v3.clar`

**Key Functions**:
- `bridge-and-purchase(ticket-count, base-address, token-principal)` - User entry point
- `confirm-purchase-processed(purchase-id, base-tx-hash)` - Operator confirmation
- `record-winnings(winner, amount, round, base-tx-hash)` - Record wins
- `claim-winnings()` - User claims back to Stacks

**Features**:
- ✅ Event emission for off-chain monitoring
- ✅ Purchase tracking with unique IDs
- ✅ Fee structure (ticket cost + bridge fee)
- ✅ Winnings management
- ✅ Emergency controls

### 2. Bridge Operator Service ✅
**File**: `src/services/stacksBridgeOperator.ts`

**Responsibilities** (triggered via Chainhook):
- 🎧 Receive Stacks contract events via Chainhook POST
- 💱 Convert Stacks Tokens → USDC (pre-funded pool strategy)
- 🎫 Execute Megapot purchases on Base
- ✅ Confirm transactions back to Stacks (future)
- 💰 Monitor and distribute winnings

**Features**:
- ✅ Event-driven via Chainhook (no polling)
- ✅ Production-ready error handling with retry logic
- ✅ Status persistence to filesystem
- ✅ USDC balance monitoring
- ✅ Automatic gas management
- ✅ 10% referral fee earning from Megapot

**Note**: Chainhook is configured in `chainhook-predicate.json` and actively running. No need to run a background service anymore.

### 3. Bridge Protocol Integration ✅
**File**: `src/services/bridges/protocols/stacks.ts`

Integrates Stacks bridge with unified bridge manager for:
- ✅ Automatic fallback to other protocols
- ✅ Health monitoring
- ✅ Performance tracking
- ✅ Consistent status callbacks

### 4. Frontend Integration ✅
**Files**:
- `src/hooks/useCrossChainPurchase.ts` - Purchase logic
- `src/components/bridge/CrossChainTracker.tsx` - Status UI
- `src/domains/wallet/services/unifiedWalletService.ts` - Wallet connection

**Features**:
- ✅ Stacks wallet integration (Leather, Xverse, Asigna, Fordefi)
- ✅ Real-time status tracking
- ✅ Transaction history
- ✅ Error handling with user-friendly messages

## Flow Diagrams

### Purchase Flow
```
1. USER (Stacks)
   ├─> Connects Stacks wallet (Leather/Xverse/etc)
   └─> Calls: bridge-and-purchase(5 tickets, "0xABC...", token-principal)
       └─> Transfers tokens to bridge contract

2. STACKS CONTRACT
   ├─> Records purchase with unique ID
   ├─> Emits: "bridge-purchase-initiated" event
   └─> Status: confirmed_stacks

3. CHAINHOOK SERVICE
   ├─> Detects event via on-chain monitoring
   ├─> POST to /api/chainhook with event data
   └─> Forwards to StacksBridgeOperator

4. BRIDGE OPERATOR (Off-chain, triggered by Chainhook)
   ├─> Receives event via /api/chainhook
   ├─> Checks USDC reserve (pre-funded)
   ├─> Status: bridging
   ├─> Approves USDC for Megapot
   ├─> Calls Megapot.purchaseTickets() on Base
   │   └─> Referrer: Operator address (10% fee!)
   │   └─> Recipient: User's Base address
   └─> Status: purchasing

4. BASE (Megapot)
   ├─> Tickets credited to user's address
   └─> Transaction confirmed

5. BRIDGE OPERATOR (Confirmation)
   └─> Calls Stacks contract: confirm-purchase-processed()
       └─> Status: complete

6. USER
   └─> Can verify tickets on Base via UI
```

### Winnings Flow (Future Enhancement)
```
1. MEGAPOT (Daily Drawing)
   └─> User wins! Tracked in contract

2. BRIDGE OPERATOR (Monitoring)
   ├─> Polls Megapot.usersInfo()
   └─> Calls Stacks: record-winnings()

3. USER (Stacks)
   └─> Calls: claim-winnings()

4. BRIDGE OPERATOR
   ├─> Withdraws from Megapot on Base
   ├─> Converts USDC → sBTC
   └─> Transfers to user on Stacks
```

## Setup & Deployment

### Prerequisites
```bash
# Required
- Node.js 18+
- pnpm
- Stacks wallet (for contract deployment)
- Base wallet with USDC (for operator)
```

### Environment Configuration

Create `.env.local`:
```bash
# CRITICAL: Operator private key (never commit!)
STACKS_BRIDGE_OPERATOR_KEY=0x...

# Stacks Configuration
STACKS_LOTTERY_CONTRACT=SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3
NEXT_PUBLIC_STACKS_API_URL=https://api.mainnet.hiro.so

# Base Configuration  
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_MEGAPOT_CONTRACT=0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95

# Liquidity Strategy
LIQUIDITY_STRATEGY=pre-funded  # or 'real-time' (future)
```

### Deploy Stacks Contract

✅ **V3 Deployed!**
- **Contract ID**: `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3`
- **Network**: Stacks Mainnet

The contract is already configured in `.env.local`.

### Generate & Fund Operator Wallet

**Step 1: Generate operator wallet**

```bash
# Option A: Use cast (Foundry)
cast wallet new

# Option B: Use Node.js
node -e "const crypto = require('crypto'); console.log('0x' + crypto.randomBytes(32).toString('hex'))"
```

**Step 2: Add private key to .env.local**

```bash
# Edit .env.local and replace the placeholder
STACKS_BRIDGE_OPERATOR_KEY=0xYOUR_ACTUAL_PRIVATE_KEY
```

**CRITICAL**: Never commit this key to git!

**Step 3: Get operator address**

```bash
cast wallet address --private-key $STACKS_BRIDGE_OPERATOR_KEY
```

**Step 4: Fund the operator**

The operator needs on Base:
- **100 USDC** minimum (for ~100 tickets)
- **0.01 ETH** (for gas)

Transfer to the address from Step 3.

### Chainhook 2.0 Configuration (Hiro Platform - Hosted)

The bridge uses **Chainhooks 2.0** (hosted on Hiro Platform) for reliable, reorg-aware event detection.

**Status**: ✅ **Already Registered**
- **UUID**: `480d87da-4420-4983-ae0e-2227f3b31200`
- **Status**: `streaming` (actively monitoring)
- **URL**: https://platform.hiro.so

**To re-register** (if needed):

```bash
# Set environment variables
export CHAINHOOK_API_KEY=your_api_key_from_https://platform.hiro.so
export CHAINHOOK_SECRET_TOKEN=your_webhook_authorization_secret
export CHAINHOOK_WEBHOOK_URL=https://yourdomain.com/api/chainhook

# Register the chainhook
npx tsx scripts/register-chainhook-v2.ts
```

**What Happens**:
1. Chainhooks 2.0 service monitors Stacks mainnet
2. Detects `bridge-purchase-initiated` events from contract `SP31BERCCX5RJ20W9Y10VNMBGGXXW8TJCCR2P6GPG.stacks-lottery-v3`
3. POSTs to `/api/chainhook` with the webhook payload
4. Payload is routed to `StacksBridgeOperator.processBridgeEvent()`

**Payload Structure** (Chainhooks 2.0):
```
{
  "event": {
    "apply": [{
      "block_identifier": {...},
      "transactions": [{
        "transaction_identifier": {"hash": "0x..."},
        "operations": [
          {
            "type": "contract_log",
            "data": {
              "value": {
                "repr": "(event ...)",
                "data": {
                  "base-address": {"repr": "0x..."},
                  "ticket-count": {"repr": "u5"},
                  "sbtc-amount": {"repr": "u5100000"},
                  "token": {"repr": "SP3Y2ZSH..."}
                }
              }
            }
          }
        ]
      }]
    }]
  },
  "chainhook": {...}
}
```

**Status**: ✅ Chainhooks 2.0 (Beta) - Modern, hosted, reliable

**Benefits over v1**:
- ✅ Fully hosted (no self-hosted binary management)
- ✅ Built-in reorg handling
- ✅ Better performance and reliability
- ✅ Automatic queuing and retries
- ✅ Dashboard observability at https://platform.hiro.so

## Liquidity Management

### Strategy 1: Pre-funded Pool (Current) ✅

**How it works**:
1. Operator maintains USDC reserve on Base
2. Each ticket purchase deducts from reserve
3. Operator manually refills when low

**Pros**:
- ✅ Simple to implement
- ✅ Fast execution
- ✅ No complex DeFi integrations

**Cons**:
- ⚠️ Requires manual monitoring
- ⚠️ Capital locked on Base
- ⚠️ Need to manage refills

**Monitoring**:
```bash
# Check operator balance
cast balance --rpc-url $NEXT_PUBLIC_BASE_RPC_URL \
  --erc20 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  $OPERATOR_ADDRESS
```

### Strategy 2: Real-time Conversion (Future) 🚧

**Planned architecture**:
1. Accept Stacks tokens (USDC, sUSDT, aeUSDC) on Stacks
2. Bridge assets via automated cross-chain routes
3. Swap for USDC on Base (if needed)
4. Purchase tickets

**Pros**:
- ✅ Automated liquidity
- ✅ No manual refills
- ✅ Capital efficient

**Cons**:
- ⚠️ Complex DeFi integrations
- ⚠️ Slippage risk
- ⚠️ More points of failure

## Business Model

### Revenue Streams

1. **Bridge Fee**: 1 USDC (0.10 per ticket)
2. **Megapot Referral**: 10% of ticket price (0.10 USDC per ticket)
3. **Yield on Reserve**: Earning yield on the pre-funded USDC pool

### Economics Example (100 tickets/day)

**Revenue**:
- Bridge fees: 100 × 0.10 USDC = $10/day
- Referral fees: 100 × $1 × 10% = $10/day
- **Total**: ~$20/day = $600/month

**Costs**:
- Base gas fees: ~$50-100/month (variable)
- Server infrastructure: ~$50/month
- **Total**: ~$100-150/month

**Net Profit**: ~$450-500/month @ 100 tickets/day

Scale at 1000 tickets/day → **~$31,500/month profit!**

## Monitoring & Operations

### Health Checks

```bash
# Check recent purchases
cat scripts/purchase-status.json | jq '.[] | select(.status == "complete")'

# Check Chainhook status (configured in Hiro dashboard)
# https://dashboard.chainhook.io/

# Check USDC balance
# (see Liquidity Management section)
```

### Status Files

**Location**: `scripts/`
- `purchase-status.json` - All purchase statuses
- `cross-chain-purchases.json` - UI tracking data

**Status Values**:
- `confirmed_stacks` - Stacks tx confirmed
- `bridging` - Converting sBTC → USDC
- `purchasing` - Buying tickets on Base
- `complete` - Success ✅
- `error` - Failed ❌

### Alerts & Monitoring

**Set up alerts for**:
- ⚠️ Low USDC balance (< 100 USDC)
- ⚠️ Failed purchases (status: error)
- ⚠️ Chainhook service down (check Hiro dashboard)
- ⚠️ High gas prices on Base

## Security Considerations

### Operator Key Management 🔐

**CRITICAL**:
- ✅ Store private key in secure secrets manager (e.g., AWS Secrets Manager)
- ✅ Use hardware wallet for production
- ✅ Enable 2FA on all infrastructure
- ❌ NEVER commit private key to git
- ❌ NEVER share operator key

### Contract Security

**Deployed Contract**:
- ✅ Owner controls for emergency pause
- ✅ Fee limits to prevent exploitation
- ✅ Proper event emission for auditing
- ✅ Purchase ID tracking prevents replay

**Recommended**:
- 🔍 Professional security audit before mainnet
- 🔍 Bug bounty program
- 🔍 Multi-sig for contract owner

### Trust Model

**Users must trust operator to**:
1. Actually purchase tickets on Base
2. Not steal funds
3. Process winnings withdrawals

**Mitigation strategies**:
1. ✅ Open source code (this repo)
2. ✅ Publish all Base transaction hashes
3. ✅ Real-time status tracking
4. 🔜 Multi-sig operator (future)
5. 🔜 ZK proofs for purchase verification (future)

## Testing

### Testnet Testing

```bash
# 1. Deploy contract to testnet
clarinet deploy --testnet

# 2. Update .env.local with testnet contract
STACKS_LOTTERY_CONTRACT=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM

# 3. Fund operator with testnet USDC on Base Sepolia
# Get from faucet: https://faucet.circle.com/

# 4. Start operator
./scripts/start-stacks-bridge.sh

# 5. Make test purchase from Stacks wallet
# Use Hiro Wallet testnet mode
```

### Unit Testing

```bash
# Test contract (Clarity)
clarinet test contracts/stacks-lottery.clar
```

## Troubleshooting

### Issue: Chainhook not detecting events

**Solution**:
```bash
# Check Chainhook status at Hiro Platform dashboard
# https://platform.hiro.so → Your Project → Chainhooks

# Verify chainhook is registered and enabled
export CHAINHOOK_API_KEY=your_api_key
npx tsx -e "
import { ChainhooksClient, CHAINHOOKS_BASE_URL } from '@hirosystems/chainhooks-client';
const client = new ChainhooksClient({ baseUrl: CHAINHOOKS_BASE_URL.mainnet, apiKey: process.env.CHAINHOOK_API_KEY });
const ch = await client.getChainhook('480d87da-4420-4983-ae0e-2227f3b31200');
console.log(JSON.stringify(ch, null, 2));
"

# Check Stacks API status
curl https://api.mainnet.hiro.so/v2/info | jq '.version'

# Check webhook endpoint is accessible
curl -I https://yourdomain.com/api/chainhook
```

### Issue: Insufficient USDC balance

**Solution**:
```bash
# Transfer more USDC to operator address
# Check minimum: 1000 USDC recommended

# Monitor balance continuously
watch -n 60 'cast balance --rpc-url $BASE_RPC --erc20 $USDC $OPERATOR'
```

### Issue: Purchase failed on Base

**Solution**:
```bash
# Check Base RPC is working
cast block-number --rpc-url $NEXT_PUBLIC_BASE_RPC_URL

# Check Megapot contract
cast call $MEGAPOT "isPaused()" --rpc-url $BASE_RPC

# Check operator has gas
cast balance $OPERATOR_ADDRESS --rpc-url $BASE_RPC
```

## Recent Enhancements (December 2025 - Chainhooks 2.0 Migration)

### Migrated to Chainhooks 2.0 ✅

**Status**: Fully migrated from self-hosted Chainhook v1 to Hiro Platform Chainhooks 2.0 (Beta)

#### What Changed

**From v1 (self-hosted)**:
- ❌ Local Chainhook binary with multiple dependencies
- ❌ JSON predicate file configuration (`chainhook-predicate.json`)
- ❌ Payload structure: `metadata.receipt.events`
- ❌ Manual binary management and updates

**To v2 (hosted)**:
- ✅ Hiro Platform hosted service (no setup required)
- ✅ TypeScript SDK registration (`scripts/register-chainhook-v2.ts`)
- ✅ Payload structure: `event.apply[].transactions[].operations[]`
- ✅ Automatic reorg handling, queuing, retries
- ✅ Dashboard observability at https://platform.hiro.so

#### What Was Enhanced

**Purchase Flow** → Full provenance trail:
- Fixed function name bug (`bridge-and-purchase-tickets` → `bridge-and-purchase`)
- Multi-token support: Bridge via USDC, aeUSDC, or sUSDT
- Stacks Explorer link: verify tokens left user's wallet
- Base Explorer link: verify Megapot received the purchase
- Megapot app link: view tickets directly

**Winnings Auto-Detection** → Zero user action:
- Operator polls Megapot every 30 seconds for wins
- Operator records wins on Stacks contract via `@stacks/transactions`
- Frontend polls every 60 seconds for automatic UI refresh
- Status propagates from operator → API → frontend

**Winnings Claiming** → Simple redemption flow:
- User calls `claim-winnings()` on Stacks contract
- Operator detects claim and processes redemptions
- Stacks tokens transferred to user's Stacks wallet

**Operator Monitoring** → Simple, observable:
- Logs all activity to `logs/operator.log`
#### Files Enhanced (ENHANCEMENT FIRST + AGGRESSIVE CONSOLIDATION)

**Enhanced**:
| File | Enhancement |
|------|-------------|
| `src/app/api/chainhook/route.ts` | Rewritten for Chainhooks 2.0 payload structure (operations array, contract_log type) |
| `docs/STACKS_BRIDGE.md` | Updated setup, payload structure, troubleshooting for v2 |
| `scripts/register-chainhook-v2.ts` | New: TypeScript SDK-based registration (replaces JSON config) |

**Deleted** (CONSOLIDATION):
- `chainhook-predicate.json` - JSON v1 format, replaced by SDK registration
- `chainhook-predicate.example.json` - No longer needed
- Old operator scripts already deleted in prior enhancements

**Payload Processing Changes**:
- Old: `tx.metadata?.receipt?.events` → `event.type === 'SmartContractEvent'`
- New: `tx.operations` → `op.type === 'contract_log'`
- Field extraction now handles Clarity tuple structure from v2

**Total enhanced files**: 3 (DRY principle: single source of truth in STACKS_BRIDGE.md)

#### How to Verify MVP Works

**Full End-to-End Test** (assumes Megapot drawing happens within test window):

```bash
# 1. Start operator with logging
./scripts/start-stacks-bridge.sh

# 2. Check operator is healthy
./scripts/health-check-operator.sh

# 3. Make a test purchase via UI
# - Connect Stacks wallet
# - Buy 1 ticket for your Base address
# - Watch tracker show progress with receipt links

# 4. Inspect transaction record
cat scripts/purchase-status.json | jq '.[] | {status, stacksTxId, baseTxId}'

# 5. Monitor operator for winnings detection (in another terminal)
tail -f logs/operator.log | grep -i "win\|record"

# 6. Wait for next Megapot daily drawing
# - Operator polls every 30 seconds
# - Should log: "[Operator] 🎉 WIN DETECTED!"

# 7. Frontend shows winnings (auto-polled every 60s)
# - Check app for "Claimable Winnings" display

# 8. Claim winnings via UI
# - Click "Claim Winnings" button
# - Sign transaction in wallet
# - See confirmation

# 9. Verify claim was recorded on Stacks
tail logs/operator.log | grep "claim-winnings\|Claim transaction"

# 10. Operator processes redemption
# - Withdraws USDC from Megapot
# - Transfers Stacks tokens to user on Stacks
```

**Quick Health Check**:
```bash
./scripts/health-check-operator.sh
```

Should show:
```
✅ Process is running
💰 Balance: 50+ USDC
✅ Stacks API responding
✅ Recent purchases
```

## Roadmap

### Phase 1: MVP (Current) ✅
- [x] Stacks contract deployment (V1)
- [x] V3 Deployment with Multi-Token support
- [x] Bridge operator with pre-funded liquidity
- [x] Frontend integration
- [x] Status tracking + receipt verification
- [x] Winnings auto-detection
- [x] Documentation

### Phase 2: Production Hardening (Next)
- [x] Stacks contract call integration for `record-winnings()` ✅ DONE
- [ ] Winnings claim-back monitoring & batch processing
- [ ] Security audit
- [ ] Multi-wallet pool (10-20 addresses)
- [ ] Automated liquidity monitoring
- [ ] Alerting & monitoring dashboard
- [ ] Load testing

### Phase 3: Advanced Features (Future)
- [ ] Auto-claim winnings & bridge back to Stacks
- [ ] Real-time liquidity conversion
- [ ] Multi-sig operator
- [ ] ZK proofs for transparency
- [ ] Mobile app integration

### Phase 4: Scale (Q2 2025)
- [ ] Automated marketing
- [ ] Referral program
- [ ] Analytics dashboard
- [ ] API for third-party integration

## Support

### Documentation
- Main README: `/README.md`
- Bridge Technical: `/docs/CROSSCHAIN_TECHNICAL.md`
- Implementation: `/docs/IMPLEMENTATION.md`

### Contact
- GitHub Issues: [syndicate/issues](https://github.com/yourusername/syndicate/issues)
- Discord: [Your Discord](https://discord.gg/yourserver)

---

**Built with ❤️ following ENHANCEMENT FIRST principles**
