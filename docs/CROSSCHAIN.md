# Cross-Chain Bridge Implementation

**Last Updated**: Dec 4, 2025  
**Status**: Complete System (Forward + Reverse Bridge)
**Core Principles**: ENHANCEMENT FIRST, DRY, CLEAN, MODULAR, ORGANIZED

## Progress Update (Dec 2025)

- Unified Bridge Manager orchestrates protocols with automatic fallback
- CCTP consolidated into `src/services/bridges/protocols/cctp.ts` with shared attestation logic
- Solana→Base CCTP V2 aligned: manual instruction build, correct PDAs, and message extraction
- Base mint flow: automatic redemption attempted; UI provides manual mint on Base via `receiveMessage`
- Wormhole fallback updated to SDK v4 for EVM routes; signers adapted; VAA retrieval and redeem implemented
- Protocol selection uses `estimateAllRoutes` for cost/time estimates in `ProtocolSelector`

## Recent Review (Nov 24, 2025)

**3 Issues Fixed:**
1. ✅ **UI Inconsistency** - `/bridge` page now uses `FocusedBridgeFlow` (consistent with modal)
2. ✅ **Bridge Doesn't Work** - Unified wallet state; EVM address now guaranteed; better error messages
3. ✅ **Wallet State Scattered** - `useWalletConnection()` now returns both Solana + EVM wallet data

**Changes Made:**
- `src/services/bridges/index.ts` - Unified manager, lazy protocol loading
- `src/services/bridges/protocols/cctp.ts` - Consolidated CCTP (EVM + Solana) and attestation fetch
- `src/services/bridges/protocols/wormhole.ts` - Updated to SDK v4, EVM signer adapter, VAA redeem
- `src/components/bridge/ProtocolSelector.tsx` - Estimates fetched from unified manager
- `src/app/bridge/page.tsx` - Clean wallet cards and bridge flow

**Testing:**
- [ ] Test CCTP Solana→Base burn and attestation; use manual Base mint if auto-redeem fails
- [ ] Test EVM→Base CCTP with consolidated attestation
- [ ] Test Wormhole EVM→EVM fallback routes (Ethereum/Base/Polygon/Avalanche)
- [ ] Verify ProtocolSelector shows estimates and routes

## Solana Bridge Overview

### Understanding Phantom's Multi-Chain Support

**IMPORTANT:** Phantom wallet is multi-chain and provides:
- **Solana address** (base58 format): For Solana transactions
- **EVM address** (0x format): For Ethereum, Base, Polygon, etc.

**Your Setup (CORRECT):**
```
Source: Phantom Solana address → Bridge USDC from Solana
Recipient: Phantom EVM address → Receive USDC on Base
```

This is a valid configuration! The validation error was overly strict.

## Critical UX Issues & Fixes

### 1. ✅ Address Validation (UPDATED)

**Previous Issue:** Validation rejected valid Phantom EVM addresses
**Fix Applied:** Validates EVM format (0x..., 42 chars) but allows Phantom's EVM address

```typescript
// Validates format, not wallet provider
if (!recipientEvm || !recipientEvm.startsWith('0x') || recipientEvm.length !== 42) {
  return { success: false, error: 'Recipient must be valid EVM address', protocol: 'cctp' };
}
```

### 2. ✅ Background Processing (IMPLEMENTED - Minimal Approach)

**Solution:** Minimal state management without polling
- Stores only tx signature + metadata in localStorage
- Checks balance on page load (reuses existing logic)
- Shows notification if bridge completed
- No resource-intensive polling

**Implementation:**
```typescript
// Save state when tx sent
savePendingBridge({
  signature,
  protocol,
  amount,
  recipient,
  timestamp: Date.now()
});

// Check on page load (usePendingBridge hook)
const pending = getPendingBridge();
if (pending && hasBridgeCompleted(currentBalance, expectedAmount)) {
  toast.success('Bridge complete! USDC arrived on Base');
  clearPendingBridge();
}
```

### 3. ✅ Protocol Selection (IMPLEMENTED)

**Solution:** Clear visual comparison in BridgeGuidanceCard
- Side-by-side protocol cards
- Shows time estimate (5-10 min vs 15-20 min)
- Visual indicators (⚡ Recommended vs 🔵 Native USDC)
- Defaults to Wormhole (faster)

**UI:**
```tsx
<div className="grid grid-cols-2 gap-3">
  <ProtocolCard name="Wormhole" time="5-10 min" badge="⚡ Recommended" />
  <ProtocolCard name="CCTP" time="15-20 min" badge="🔵 Native USDC" />
</div>
```

### 4. ✅ User Can Leave (IMPLEMENTED)

**Solution:** Clear messaging + explorer link
- Shows "You can safely close this page!" message
- Displays estimated completion time
- Provides Solana Explorer link for tracking
- Transaction completes regardless

**UI in InlineBridgeFlow:**
```tsx
<div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
  <p>💡 <strong>You can safely close this page!</strong></p>
  <p>Your bridge will complete in {protocol === 'cctp' ? '15-20' : '5-10'} minutes.</p>
  <a href={getSolanaExplorerLink(txHash)}>Track on Solana Explorer</a>
</div>
```

### 5. ✅ Resume Notification (IMPLEMENTED)

**Solution:** Automatic detection on page load
- `PendingBridgeNotification` component
- Shows pending bridge info
- Links to explorer
- Dismissible
- Auto-clears when complete

**Components Created:**
- `src/utils/bridgeStateManager.ts` - State management
- `src/hooks/usePendingBridge.ts` - Detection hook
- `src/components/bridge/PendingBridgeNotification.tsx` - UI component

### 3. 🚀 Faster Bridging Options

**Current Protocols:**
- **CCTP:** 15-20 minutes (native USDC, secure)
- **Wormhole:** 5-10 minutes (wrapped USDC, needs swap)

**Faster Alternatives to Consider:**

1. **Wormhole with Automatic Relaying** (Currently implemented)
   - Already in code but may need testing
   - Should be 5-10 minutes total
   - May require swap to native USDC

2. **Third-Party Relayers** (Not implemented)
   - Services like Mayan, Allbridge
   - Can be 1-3 minutes
   - Higher fees but better UX

3. **Optimistic Bridging** (Not implemented)
   - Show "pending" USDC immediately
   - Allow purchases while bridge completes
   - Requires trust layer

**Recommendation:** Test Wormhole path more thoroughly as it's already implemented and should be faster.

### 4. 🎯 User Flow Review

**Current CCTP Flow:**
```
1. User clicks "Bridge & Buy" → Instant
2. Phantom prompts for signature → User action (5-10 sec)
3. Transaction sent to Solana → 1-2 seconds
4. Wait for confirmation → 30-60 seconds
5. Extract CCTP message → 5 seconds
6. Wait for Circle attestation → 15-20 MINUTES ⏱️
7. Ready to mint on Base → Instant
8. User can complete purchase → Instant
```

**UX Problems:**
- ❌ Step 6 is too long (15-20 min)
- ❌ User must keep page open
- ❌ No way to resume if page closes
- ❌ No notifications when complete

**Current Wormhole Flow:**
```
1. User clicks "Bridge & Buy" → Instant
2. Phantom prompts for signature → User action (5-10 sec)
3. Transaction sent to Solana → 1-2 seconds
4. Wait for confirmation → 30-60 seconds
5. Wormhole guardians sign → 5-10 MINUTES ⏱️
6. Automatic relay to Base → 1-2 minutes
7. (Optional) Swap wrapped→native USDC → 1 minute
8. User can complete purchase → Instant
```

**Better but still issues:**
- ⚠️ Still 5-10 minutes total
- ❌ User must keep page open
- ✅ Faster than CCTP

### 5. 💡 Recommended UX Improvements

**Priority 1: Background Processing**
```typescript
// In InlineBridgeFlow.tsx
useEffect(() => {
  // Save bridge state
  if (currentStatus && txHash) {
    saveBridgeState({
      txHash,
      amount,
      recipient,
      protocol,
      status: currentStatus,
      timestamp: Date.now()
    });
  }
}, [currentStatus, txHash]);

// Allow users to close modal
<div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
  <p className="text-blue-300 text-sm">
    💡 <strong>You can close this modal!</strong> We'll continue bridging in the background 
    and notify you when complete. Your transaction is safe on Solana.
  </p>
  <Button onClick={onClose} variant="outline" className="mt-3">
    Close & Continue Browsing
  </Button>
</div>
```

**Priority 2: Resume Bridge UI**
```typescript
// On page load, check for pending bridges
useEffect(() => {
  const pending = getPendingBridge();
  if (pending) {
    setShowResumeModal(true);
  }
}, []);

// Show resume modal
<Modal open={showResumeModal}>
  <h3>Bridge in Progress</h3>
  <p>You have a pending bridge from {formatTime(pending.timestamp)}</p>
  <p>Amount: {pending.amount} USDC</p>
  <p>Status: {pending.status}</p>
  <Button onClick={() => resumeBridge(pending)}>
    Resume Monitoring
  </Button>
  <Button onClick={() => dismissBridge(pending)} variant="ghost">
    Dismiss (transaction will still complete)
  </Button>
</Modal>
```

**Priority 3: Protocol Selection UI**
```typescript
// Let users choose based on speed vs cost
<div className="grid grid-cols-2 gap-4 mb-6">
  <ProtocolCard
    name="CCTP"
    time="15-20 min"
    cost="~$0.50"
    badge="Native USDC"
    selected={protocol === 'cctp'}
    onClick={() => setProtocol('cctp')}
  />
  <ProtocolCard
    name="Wormhole"
    time="5-10 min"
    cost="~$1.00"
    badge="Faster"
    selected={protocol === 'wormhole'}
    onClick={() => setProtocol('wormhole')}
  />
</div>
```

## What Was Fixed

1. ✅ **Address Validation** - Validates EVM format (allows Phantom EVM address)
2. ✅ **Transaction Signing** - Wallet properly added as signer
3. ✅ **Confirmation Logic** - Waits up to 90 seconds, handles finalized status
4. ✅ **Message Extraction** - Better parsing of CCTP messages from logs
5. ⚠️ **Background Processing** - NOT YET IMPLEMENTED (recommended)
6. ⚠️ **Protocol Selection UI** - EXISTS but could be clearer

## Quick Test

```typescript
// 1. Dry run test (no real transaction)
await solanaBridgeService.bridgeUsdcSolanaToBase(
  '1',
  'YourPhantomEvmAddress', // 0x... format from Phantom
  { dryRun: true }
);

// 2. Real test with 1 USDC
await solanaBridgeService.bridgeUsdcSolanaToBase(
  '1',
  'YourPhantomEvmAddress', // Same Phantom wallet, EVM address
  {
    onStatus: (status, data) => console.log(status, data),
    preferredProtocol: 'wormhole' // Try Wormhole first (faster)
  }
);
```

## Prerequisites

- [ ] Phantom wallet installed
- [ ] ≥0.01 SOL for gas fees
- [ ] USDC on Solana (check Phantom)
- [ ] Phantom EVM address (0x...) - get from Phantom settings

## Expected Timeline

- **Wormhole:** 5-10 minutes (RECOMMENDED - faster)
- **CCTP:** 15-20 minutes (slower but native USDC)

## Common Errors

| Error | Solution |
|-------|----------|
| "Recipient must be valid EVM address" | Ensure using Phantom's EVM address (0x...), not Solana address |
| "Phantom wallet not found" | Install Phantom extension |
| "Insufficient USDC" | Check USDC balance in Phantom (Solana network) |
| "Insufficient SOL" | Need ≥0.01 SOL for gas fees |
| "User rejected" | Approve transaction in Phantom popup |
| "Transaction timeout" | Solana network may be congested, check explorer |

## Testing Recommendations

### Start Small
1. Test with dry run mode first
2. Then test with 1 USDC
3. Try Wormhole protocol first (faster)
4. Only increase amount after successful test

### Monitor Progress
```typescript
const statusLog: string[] = [];

await solanaBridgeService.bridgeUsdcSolanaToBase('1', evmAddress, {
  onStatus: (status, data) => {
    statusLog.push(`[${new Date().toISOString()}] ${status}`);
    console.log(status, data);
    
    // Check if stuck
    if (status === 'solana_cctp:attestation_fetched') {
      console.log('⏱️ Waiting for Circle attestation (15-20 min)...');
      console.log('💡 You can close this page - transaction will complete');
    }
  }
});
```

## Files Modified

1. **src/services/solanaBridgeService.ts**
   - Added EVM address validation
   - Added wallet as signer in transaction
   - Improved confirmation logic
   - Enhanced message extraction

2. **src/utils/solanaBridgeValidation.ts**
   - Validation utilities
   - Error message helpers
   - Explorer link generators

## Next Steps

### Immediate (Before Testing)
1. ✅ Verify Phantom has both Solana and EVM addresses
2. ✅ Get Phantom EVM address (Settings → Show EVM address)
3. ✅ Ensure sufficient SOL for gas
4. ✅ Test with dry run first

### Short Term (UX Improvements)
1. 🔄 Implement background processing
2. 🔄 Add resume bridge UI
3. 🔄 Improve protocol selection
4. 🔄 Add browser notifications
5. 🔄 Test Wormhole path thoroughly

### Medium Term (Performance)
1. 🔄 Investigate faster bridge options
2. 🔄 Consider third-party relayers
3. 🔄 Optimize transaction confirmation
4. 🔄 Add retry logic for failed attestations

## Key Insights

1. **Phantom is Multi-Chain:** Same wallet, different addresses per chain
2. **Your Setup Was Correct:** Solana address → EVM address is valid
3. **Time is the Issue:** 15-20 min is too long for good UX
4. **Background Processing Needed:** Users shouldn't wait on page
5. **Wormhole is Faster:** Should be preferred for better UX

## Support

If issues persist:

1. Check browser console for detailed logs
2. Verify transaction on Solana Explorer
3. Confirm using Phantom's EVM address (0x...)
4. Wait full time for protocol (20 min CCTP, 10 min Wormhole)
5. Report with transaction signature and error details

## Integration Guide

### Using PendingBridgeNotification

Add to your main layout or app component to show notifications on page load:

```tsx
// In app/layout.tsx or similar
import { PendingBridgeNotification } from '@/components/bridge/PendingBridgeNotification';
import { useTicketPurchase } => '@/hooks/useTicketPurchase';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { userBalance } = useTicketPurchase();
  const baseBalance = parseFloat(userBalance?.usdc || '0');

  return (
    <>
      {children}
      <PendingBridgeNotification 
        currentBalance={baseBalance}
        onBridgeComplete={() => {
          // Optional: Refresh balance, show success message, etc.
          console.log('Bridge completed!');
        }}
      />
    </>
  );
}
```

### Using BridgeGuidanceCard with Protocol Selection

```tsx
// In PurchaseModal or similar
import { BridgeGuidanceCard } from '@/components/bridge/BridgeGuidanceCard';
import { saveBalanceBeforeBridge } from '@/utils/bridgeStateManager';

function PurchaseModal() {
  const handleBridge = (amount: string, protocol?: 'cctp' | 'wormhole') => {
    // Save current balance for later comparison
    saveBalanceBeforeBridge(userBalance?.usdc || '0');
    
    // Start bridge with selected protocol
    setShowBridgeFlow(true);
    setSelectedProtocol(protocol || 'wormhole');
  };

  return (
    <BridgeGuidanceCard
      sourceChain="solana"
      sourceBalance={solanaBalance || '0'}
      targetChain="base"
      targetBalance={userBalance?.usdc || '0'}
      requiredAmount={totalCost}
      onBridge={handleBridge}
      onDismiss={() => setShowBridgeGuidance(false)}
    />
  );
}
```

### Files Created

**State Management:**
- `src/utils/bridgeStateManager.ts` - Minimal localStorage-based state management

**Hooks:**
- `src/hooks/usePendingBridge.ts` - Check for pending bridges on mount

**Components:**
- `src/components/bridge/PendingBridgeNotification.tsx` - Notification UI
- Enhanced `src/components/bridge/BridgeGuidanceCard.tsx` - Protocol selection
- Enhanced `src/components/bridge/InlineBridgeFlow.tsx` - "You can leave" message

### Key Features

✅ **No Polling** - Only checks on page load
✅ **Minimal State** - Just tx signature + metadata  
✅ **Reuses Existing Code** - Balance checks already exist
✅ **Clear UX** - Users know they can leave
✅ **Auto-Detection** - Finds completed bridges automatically
✅ **Protocol Choice** - Visual comparison of options

### Testing Checklist

- [ ] Start bridge, close page, return - notification appears
- [ ] Bridge completes - notification shows success
- [ ] Dismiss notification - clears state
- [ ] Protocol selection - defaults to Wormhole
- [ ] "You can leave" message - shows after tx sent
- [ ] Explorer link - opens correct transaction


## Root Causes Identified

### 1. **Critical: Missing Wallet Signer in Transaction**

**Issue:** Line 150 in `solanaBridgeService.ts`
```typescript
const walletPublicKey = new PublicKey(phantom.publicKey.toString());
```

**Problem:** The transaction is not being signed with the wallet's private key. The code uses `phantom.signAndSendTransaction()` but doesn't add the wallet as a signer to the transaction.

**Impact:** Transaction will fail because Solana requires the fee payer to be a signer.

### 2. **CCTP Instruction Structure Issues**

**Issue:** Lines 315-328 - Instruction data format
```typescript
const discriminator = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const instructionData = Buffer.concat([
  discriminator,
  amountBuf,
  destinationDomain,
  recipientBytes32
]);
```

**Problem:** The instruction discriminator and data layout may not match Circle's CCTP V2 program expectations. The discriminator should be derived from the instruction name hash, not hardcoded.

### 3. **Missing Required Accounts in CCTP Instruction**

**Issue:** Lines 332-346 - Account keys array

**Problem:** The CCTP `depositForBurn` instruction may require additional accounts that are missing:
- Sender authority (wallet as signer)
- Message sent event rent payer
- Potentially missing PDAs

### 4. **Recipient Address Format Issue**

**Issue:** Using same Phantom wallet address as recipient

**Problem:** Phantom wallet address is a Solana address (base58), but the recipient needs to be an EVM address (0x...) on Base. The code expects `recipientEvm` to be an EVM address but if you're passing the Phantom address, this will fail.

**Critical Question:** Are you passing your Base/EVM wallet address as the recipient, or your Solana Phantom address?

### 5. **Message Extraction from Logs**

**Issue:** Lines 599-635 - `extractMessageFromLogs` method

**Problem:** The message extraction logic is too simplistic and may not correctly parse CCTP message events:
```typescript
if (log.includes('MessageSent')) {
  const match = log.match(/MessageSent\s+([0-9a-fA-Fx]+)/);
  // ...
}
```

CCTP messages are emitted as program data logs, not simple string patterns.

### 6. **PDA Derivation Issues**

**Issue:** Lines 285-296 - PDA seeds

**Problem:** The PDA seeds might be incorrect. Circle's CCTP program uses specific seed formats:
- Seeds should match exactly what the program expects
- Domain encoding (LE vs BE) matters
- Missing the USDC mint in some PDAs

### 7. **Transaction Confirmation Timing**

**Issue:** Lines 430-443 - `confirmWithHttpPolling`

**Problem:** 
- Only waits for 'confirmed' or 'finalized' status
- Doesn't handle 'processed' status
- May timeout too quickly (40 attempts × 1.5s = 60s)
- CCTP requires 'finalized' confirmation for security

## Detailed Fixes

### Fix 1: Correct Wallet Signing

**File:** `src/services/solanaBridgeService.ts`

**Current (Line 364-369):**
```typescript
transaction.feePayer = walletPublicKey;

// Sign and send transaction
onStatus?.('solana_cctp:signing');
const signedTx = await phantom.signAndSendTransaction(transaction);
```

---

## NEAR Winnings Withdrawal - Complete System

**Status**: ✅ Implemented (December 5, 2025)  
**Architecture**: Reverse bridge from Base to NEAR using derived EVM addresses

### System Overview

Complete end-to-end cross-chain winnings withdrawal allowing NEAR users to:
1. **Discover** unclaimed winnings on their derived Base address
2. **Claim** those winnings from the Megapot contract
3. **Bridge** them back to their NEAR wallet automatically

```
NEAR Account (User's native wallet)
    ↓
Derived EVM Address (via Chain Signatures)
    ↓
Buy Tickets on Base (with USDC)
    ↓
Win & Claim Winnings on Base
    ↓
Reverse Bridge (Base → NEAR)
    ↓
Back to NEAR Account ✅
```

### Architecture Components

#### 1. Enhanced nearIntentsService (src/services/nearIntentsService.ts)

**Added three new methods while maintaining existing 1Click SDK infrastructure:**

##### `getUsdcBalanceOnChain()`
- **Purpose**: Query USDC balance on any chain for a NEAR account
- **Used for**: Cross-chain balance tracking (NEAR, Base, Ethereum)
- **Returns**: Balance in USDC amount
- **DRY**: Reuses `/api/near-queries` endpoint

```typescript
async getUsdcBalanceOnChain(params: {
  accountId: string;
  chain: 'base' | 'near' | 'ethereum';
}): Promise<string>
```

##### `withdrawWinningsToNear()`
- **Purpose**: Initiate reverse bridge from Base USDC to NEAR
- **Inputs**: EVM address, NEAR account ID, amount
- **Process**:
  1. Converts USDC to smallest units
  2. Builds 1Click quote with ORIGIN_CHAIN recipients
  3. Returns deposit address for the reverse bridge
- **Returns**: `{ success, depositAddress?, error? }`

```typescript
async withdrawWinningsToNear(params: {
  evmAddress: string;
  nearAccountId: string;
  amountUsdc: string;
}): Promise<{ success: boolean; depositAddress?: string; error?: string }>
```

##### `transferWinningsFromBaseToDeposit()`
- **Purpose**: Execute USDC transfer on Base to initiate the reverse bridge
- **Uses**: ethers.js Contract to call USDC `transfer()` on Base
- **Key Details**:
  - Uses dynamic import to avoid requiring ethers at module level
  - Handles decimal conversion (6 decimals for USDC)
  - Error parsing for user-friendly messages
- **Returns**: `{ success, txHash?, error? }`

```typescript
async transferWinningsFromBaseToDeposit(params: {
  evmProvider: unknown;
  baseUsdcAddress: string;
  evmWallet: string;
  depositAddress: string;
  amountUsdc: string;
}): Promise<{ success: boolean; txHash?: string; error?: string }>
```

#### 2. Enhanced web3Service (src/services/web3Service.ts)

**Added cross-chain balance tracking without breaking existing functionality:**

##### `getUserInfoForAddress()`
- **Purpose**: Query user ticket/winnings info for any address (not just connected wallet)
- **Used for**: Cross-chain tracking of derived EVM address from NEAR account
- **Returns**: Tickets purchased, winnings claimable, active status
- **MODULAR**: Works independently of `getCurrentTicketInfo()` which queries the connected wallet

```typescript
async getUserInfoForAddress(address: string): Promise<{
  ticketsPurchased: number;
  winningsClaimable: string;
  isActive: boolean;
  rawValue: BigNumberish;
} | null>
```

#### 3. Enhanced useTicketPurchase Hook (src/hooks/useTicketPurchase.ts)

**New State Properties:**
```typescript
// Withdrawal flow state
nearWithdrawalWaitingForDeposit?: boolean;      // Waiting for user confirmation
nearWithdrawalDepositAddress?: string | null;   // Where to send winnings
nearWithdrawalDepositAmount?: string | null;    // Amount to withdraw
nearWithdrawalTxHash?: string | null;           // Transfer confirmation
isWithdrawingWinningsToNear?: boolean;          // Current processing state
```

**New Action: `claimAndWithdrawWinningsToNear()`**
- **Process** (5 steps):
  1. Claim winnings on Base
  2. Get updated user info to determine amount
  3. Initialize NEAR Intents service
  4. Request reverse bridge quote (Base → NEAR)
  5. Update state and wait for user confirmation
- **Returns**: Claim transaction hash
- **Error Handling**: Comprehensive error messages at each step
- **Graceful Degradation**: If anything fails, user can retry

```typescript
const claimAndWithdrawWinningsToNear = useCallback(
  async (nearAccountId: string): Promise<string>
)
```

### Technical Decisions

#### 1. **Reused 1Click SDK for Reverse Bridge**
- **Why**: Leverages existing solver infrastructure
- **Benefit**: Same proven bridge mechanism in reverse
- **Cost**: Minimal integration - just different asset direction

#### 2. **Two-Step User Action**
- **Step 1**: Claim winnings + get bridge address
- **Step 2**: Confirm + transfer to bridge
- **Why**: Gives user time to review the amount and destination
- **Compared to**: Auto-bridge would be faster but less transparent

#### 3. **Dynamic ethers.js Import in nearIntentsService**
- **Why**: Avoids circular dependencies
- **Benefit**: nearIntentsService stays independent of web3Service
- **Pattern**: Same approach as in other bridge implementations

#### 4. **Balance Queries Decoupled**
- **`getNearBalance()`**: NEAR account USDC balance
- **`getUsdcBalanceOnChain()`**: USDC on specific chain
- **`getUserInfoForAddress()`**: Ticket info on Base
- **Why**: Each has different data source and use case
- **DRY**: Reuses `/api/near-queries` endpoint

### Core Principles Applied

#### ✅ ENHANCEMENT FIRST
- Enhanced `nearIntentsService` with reverse bridge methods
- Enhanced `web3Service` with cross-chain queries
- Enhanced `useTicketPurchase` hook with withdrawal actions
- **No new services created**

#### ✅ AGGRESSIVE CONSOLIDATION
- Reused 1Click SDK (no new bridge protocol)
- Reused existing endpoint for balance queries
- Reused existing contract queries on Base
- Single source of truth for each operation

#### ✅ PREVENT BLOAT
- Minimal new state properties (5 related fields)
- Two composable methods (claim + transfer)
- Focused on NEAR reverse flow only
- No unused complexity

#### ✅ DRY
- 1Click SDK configured once, reused for both directions
- Balance queries use same endpoint
- Error parsing consolidated in `nearIntentsService`
- No duplicate bridge logic

#### ✅ CLEAN
- Clear separation: Service layer (nearIntentsService) vs Hook (useTicketPurchase)
- nearIntentsService handles NEAR intents operations
- useTicketPurchase orchestrates the withdrawal flow
- web3Service handles Base contract interactions

#### ✅ MODULAR
- `getUsdcBalanceOnChain()` - Independent balance checker
- `withdrawWinningsToNear()` - Quote provider
- `transferWinningsFromBaseToDeposit()` - Transfer executor
- Each can be used separately if needed

#### ✅ PERFORMANT
- Reuses initialized services (no double init)
- Minimal state updates (only when needed)
- Dynamic imports avoid unnecessary bundle size
- Async/await for natural flow

#### ✅ ORGANIZED
- Service layer: `nearIntentsService.ts`
- Web3 integration: `web3Service.ts`
- Hook orchestration: `useTicketPurchase.ts`
- Documentation: This section

### API Contract

#### nearIntentsService

```typescript
// Existing methods (unchanged)
init(selector: WalletSelector, accountId: string): Promise<boolean>
isReady(): boolean
getQuote(params): Promise<IntentQuote | null>
transferUsdcToDepositAddress(params): Promise<{success, txHash?, error?}>
deriveEvmAddress(accountId: string): Promise<string | null>
getNearBalance(accountId: string): Promise<string>
getIntentStatus(depositAddress: string): Promise<{status, destinationTx?, error?}>
reset(): void

// New methods
getUsdcBalanceOnChain(params): Promise<string>
withdrawWinningsToNear(params): Promise<{success, depositAddress?, error?}>
transferWinningsFromBaseToDeposit(params): Promise<{success, txHash?, error?}>
```

#### web3Service

```typescript
// New method
getUserInfoForAddress(address: string): Promise<{
  ticketsPurchased: number;
  winningsClaimable: string;
  isActive: boolean;
  rawValue: BigNumberish;
} | null>
```

#### useTicketPurchase Hook

```typescript
// New action
claimAndWithdrawWinningsToNear(nearAccountId: string): Promise<string>
```

### Complete NEAR Winnings Withdrawal Flow

```
1. User sees "Claim & Withdraw to NEAR" button
   ↓
2. Clicks button → claimAndWithdrawWinningsToNear() executes
   ↓
3. [Behind the scenes]
   - Claim winnings on Base (on derived EVM address)
   - Initialize NEAR Intents SDK
   - Request reverse bridge quote
   - Get deposit address
   ↓
4. UI shows confirmation dialog:
   "You have $X.XX in winnings. Send to reverse bridge address?"
   ↓
5. User clicks "Confirm"
   ↓
6. transferWinningsToReverseDeposit() executes
   - Send USDC to bridge deposit address on Base
   ↓
7. [Automated on backend]
   - 1Click solver processes the deposit
   - Bridges USDC to NEAR
   - Deposits into user's NEAR account
   ↓
8. User receives USDC on NEAR ✅
```

### Error Scenarios & Recovery

| Scenario | Error Message | Recovery |
|----------|---------------|----------|
| Claiming with $0 winnings | "No winnings to withdraw" | Retry after winning more tickets |
| NEAR Intents not initialized | "Failed to initialize NEAR Intents" | Check network, retry |
| Can't derive EVM address | "Failed to derive EVM address" | User reconnects NEAR wallet |
| Reverse bridge quote fails | "Failed to get quote for reverse bridge" | Retry, may be temporary |
| Insufficient Base balance | "Insufficient USDC balance on Base" | Check Base balance, bridge more |
| User rejects transfer | "Transaction rejected by user" | User retries and approves |
| Transfer timeout | "Request timed out" | Retry, check network |

### Testing Checklist

- [ ] Test balance query on NEAR
- [ ] Test balance query on Base  
- [ ] Test reverse bridge quote generation
- [ ] Test claim & withdrawal flow with small amount
- [ ] Test error handling (insufficient balance, network issues)
- [ ] Test state transitions throughout flow
- [ ] Test UI shows deposit address correctly
- [ ] Test transfer to deposit initiates successfully
- [ ] Monitor reverse bridge completion on NEAR
- [ ] Verify USDC arrives in NEAR account

### Future Enhancements

1. **Auto-claim on next login**: Check for winnings, offer to claim + withdraw
2. **Batch processing**: If user wins multiple times, batch the withdrawals
3. **Fee estimation**: Show estimated bridge fee before confirming
4. **Progress tracking**: Real-time status of reverse bridge completion
5. **Direct withdrawal**: Option to withdraw without claiming (if contract supports it)

### Files Modified

```
Enhanced Services:
→ src/services/nearIntentsService.ts (reverse bridge methods)
→ src/services/web3Service.ts (getUserInfoForAddress)
→ src/hooks/useTicketPurchase.ts (withdrawal actions)

New Components:
→ src/components/bridge/WinningsWithdrawalFlow.tsx
→ src/components/home/WinningsCard.tsx

Enhanced Pages:
→ src/app/bridge/page.tsx (toggle + integration)
→ src/app/page.tsx (discovery card)
```
```
