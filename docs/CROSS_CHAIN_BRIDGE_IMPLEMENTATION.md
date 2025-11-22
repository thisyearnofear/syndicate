# Cross-Chain Bridge Implementation

**Last Updated**: Nov 22, 2025  
**Status**: Implementation in Progress

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

### 2. 🔄 Background Processing (NEEDED)

**Current Issue:** Bridge takes 15-20 minutes (CCTP) or 5-10 minutes (Wormhole)
**User Experience Problem:** Users must keep page open entire time

**Recommended Solution:**
1. **Store bridge state** in localStorage/IndexedDB
2. **Poll for completion** in background
3. **Show notification** when complete
4. **Allow users to leave** and return later

**Implementation Needed:**
```typescript
// Store bridge transaction
localStorage.setItem('pendingBridge', JSON.stringify({
  signature: txSignature,
  amount,
  recipient,
  protocol: 'cctp',
  startTime: Date.now(),
  status: 'waiting_attestation'
}));

// Background polling service
setInterval(() => {
  const pending = JSON.parse(localStorage.getItem('pendingBridge'));
  if (pending) {
    checkBridgeStatus(pending.signature).then(status => {
      if (status === 'complete') {
        showNotification('Bridge complete! USDC ready on Base');
        localStorage.removeItem('pendingBridge');
      }
    });
  }
}, 60000); // Check every minute
```

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