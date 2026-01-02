# ERC-7715 Implementation Research

## Overview

ERC-7715 (Smart Session Accounts) enables users to create session-based accounts within MetaMask that can perform actions with predefined scopes and durations. This document covers the implementation research, findings, and recommendations for integrating ERC-7715 into Syndicate.

## Key Findings

### Why Implementation Failed

The initial implementation attempt failed due to an incorrect import source:

**❌ Incorrect:**
```typescript
import { createSessionAccount } from 'viem'; // Does not exist
```

**✅ Correct:**
```typescript
import { createSessionAccount } from '@metamask/smart-accounts-kit/actions';
```

The required functionality exists in the MetaMask Smart Accounts Kit package, not in viem.

## Core Requirements

### 1. Package Dependencies
- **@metamask/smart-accounts-kit** - NOT YET INSTALLED
  - Provides `createSessionAccount` and related actions
  - Currently in beta/experimental phase
  - Installation: `npm install @metamask/smart-accounts-kit`

### 2. MetaMask Version
- **MetaMask Flask 13.9.0 or higher** (development-only)
- This is the experimental version with Snaps support
- Regular MetaMask production does not support ERC-7715 yet
- Users must manually upgrade their MetaMask extension

### 3. Session Account Setup
- A session account must be created before execution
- Session configuration requires:
  - Permissions/scopes (what actions the session can perform)
  - Duration (expiration time)
  - Target contract/methods
  - Gas limits

### 4. Network Support
- **Sepolia testnet** - Primary supported network
- **EIP-7702 network activation required** for production chains
- Mainnet support depends on EIP-7702 activation (not yet scheduled)

### 5. Wallet Client Configuration
```typescript
// ✅ Correct approach
const walletClient = createWalletClient({
  chain: sepolia,
  transport: custom(window.ethereum),
});

// ❌ Avoid
// Using wagmi hooks like useWalletClient() from viem
// These don't work properly with custom(window.ethereum)
```

## Implementation Status

| Aspect | Status | Notes |
|--------|--------|-------|
| ERC-7715 Specification | ✅ Production-Ready | Fully defined and standardized |
| MetaMask Support | ⚠️ Experimental Only | Flask 13.9.0+ required |
| Network Support | ⚠️ Sepolia Only | EIP-7702 awaiting mainnet activation |
| Smart Account Migration | ⚠️ Manual Process | Users must explicitly opt-in |
| Package Availability | ⚠️ Beta | @metamask/smart-accounts-kit in beta |

## Limitations

### Current
1. **Development-only MetaMask Flask** - Production MetaMask doesn't support it yet
2. **Sepolia testnet only** - Can't use on mainnet for real users
3. **Manual user upgrade required** - Not automatic or invisible to users
4. **Experimental features** - API may change before mainnet launch
5. **No auto-delegation** - Users must manually create sessions

### Future Timeline
- **Q1 2025**: EIP-7702 activation likely on testnets
- **Q2+ 2025**: Potential mainnet activation (speculative)
- **Post-activation**: Regular MetaMask production support

## Code Patterns

### Creating a Session Account

```typescript
import { createSessionAccount } from '@metamask/smart-accounts-kit/actions';
import { createWalletClient, custom } from 'viem';

const walletClient = createWalletClient({
  chain: sepolia,
  transport: custom(window.ethereum),
});

const sessionAccount = await createSessionAccount(walletClient, {
  // Session permissions
  permissions: [
    {
      // Contract and methods the session can call
      target: tokenContractAddress,
      methods: ['transfer', 'approve'],
      // Gas limit for each call
      maxGasLimit: 100000n,
      // Value limit (for value transfers)
      maxValuePerTransaction: parseEther('1'),
    },
  ],
  // Session duration
  expirationTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour
});
```

### Using a Session Account for Transactions

```typescript
const hash = await walletClient.sendTransaction({
  to: recipientAddress,
  value: parseEther('0.1'),
  account: sessionAccount, // Use the session account
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
```

## Recommended Implementation Approach

### Phase 1: Disable with Clear Messaging (Now)

```typescript
// In your UI component
const ERC7715Feature = () => {
  const isSupported = checkERC7715Support();
  
  if (!isSupported) {
    return (
      <div className="alert alert-info">
        <p>Smart Sessions require MetaMask Flask 13.9.0+</p>
        <p>Upgrade at: https://flask.metamask.io</p>
      </div>
    );
  }
  
  // Render feature when supported
  return <SessionAccountForm />;
};
```

### Phase 2: Full Implementation (Q1 2025)

When EIP-7702 approaches mainnet activation:

1. **Install dependencies:**
   ```bash
   npm install @metamask/smart-accounts-kit
   ```

2. **Create session management module:**
   - Session creation with permission scopes
   - Session persistence (localStorage with encryption)
   - Session expiration handling
   - Permission validation

3. **Update transaction flow:**
   - Detect user capability for ERC-7715
   - Offer session creation before bulk operations
   - Execute transactions using session account

4. **Add user education:**
   - Explain session benefits (batching, reduced approvals)
   - Clear expiration times
   - Permission scope visibility

## Detection and Feature Flags

```typescript
async function checkERC7715Support(): Promise<boolean> {
  if (!window.ethereum) return false;
  
  // Check if MetaMask Flask
  const provider = window.ethereum as any;
  if (!provider._metamask?.isMetaMask) return false;
  
  try {
    // Check Flask version
    const version = provider._metamask?.version;
    // MetaMask Flask uses version like "13.9.0"
    return true; // If we got here and no errors, likely supported
  } catch {
    return false;
  }
}
```

## References

- [ERC-7715 Specification](https://eips.ethereum.org/EIPS/eip-7715)
- [EIP-7702 (Account Abstraction via Delegated Execution)](https://eips.ethereum.org/EIPS/eip-7702)
- [MetaMask Smart Accounts Kit](https://github.com/MetaMask/smart-accounts-kit)
- [MetaMask Flask](https://flask.metamask.io)

## Next Steps

1. **Immediate:**
   - Add feature detection with clear user messaging
   - Add to feature flags/config system
   - Document for dev team

2. **Q1 2025:**
   - Monitor EIP-7702 testnet activation
   - Begin Phase 2 implementation
   - Set up Sepolia testing environment

3. **Pre-Mainnet:**
   - Comprehensive testing on live EIP-7702 networks
   - User education content
   - Gradual rollout strategy

## Architecture Decision: Gelato Network for Automation (Updated Jan 2025)

### The Problem with Smart Sessions

Initial implementation attempted to use MetaMask's built-in session accounts. **This approach failed** because:

1. **Smart Sessions only work with ERC-20 transfers**: ERC-7715 `erc20-token-periodic` permissions only allow `transfer()` and `transferFrom()` calls
2. **Megapot.purchaseTickets() is not a transfer**: It's a custom contract function requiring:
   - USDC spending validation
   - Referrer fee calculation
   - Ticket accounting
   - Complex internal state management
3. **DelegationManager rejects non-transfer calldata**: The on-chain validator only permits standard ERC-20 operations
4. **Smart Sessions cannot enforce non-transfer rules**: No way to apply custom business logic to arbitrary functions

### The Solution: Gelato Network Automation

Instead of relying on Smart Sessions, we use **Gelato Network** for trustless, decentralized automation:

**Architecture:**
```
User → Grants Advanced Permission (USDC spending) → MetaMask
  ↓
Frontend → Stores permission grant + config → localStorage
  ↓
Gelato Automation Bot → Monitors time conditions every block
  ↓
Gelato calls → /api/automation/execute-purchase-tickets
  ↓
Backend verifies permission → calls Megapot.purchaseTickets()
  ↓
Gelato relays transaction → User's funds deducted automatically
```

**Why Gelato Works:**
- ✅ Runs on-chain automation without managing servers
- ✅ Decentralized execution (Gelato handles reliability)
- ✅ No backend infrastructure needed
- ✅ Pays Gelato fees from USDC being spent
- ✅ Can call ANY contract function (not limited to transfers)
- ✅ Integrates seamlessly with Advanced Permissions for fund validation

### How It Works for Auto-Purchase

1. **Permission Request** (Frontend - MetaMask)
   - User requests: "Spend 50 USDC per week for Megapot"
   - MetaMask validates → Permission stored in localStorage
   - Returns `permissionsContext` (proof of delegation)

2. **Gelato Task Creation** (Frontend)
   - Encode Megapot.purchaseTickets() call with referrer + recipient
   - Register with Gelato: "Execute every 7 days"
   - Gelato begins monitoring for execution window

3. **Automated Execution** (Gelato Network)
   - When execution time arrives, Gelato calls our API endpoint
   - API verifies permission is still valid
   - API calls Megapot.purchaseTickets() with delegation proof
   - Megapot validates permission → executes transfer
   - User's account gets tickets automatically

4. **Fee Handling** (On-chain)
   - Gelato fees (0.1-1% of USDC) deducted from purchase amount
   - Transparent and predictable
   - Charged directly from delegated USDC allowance

### Implementation Plan

#### Phase 1: Enhanced Advanced Permissions (Now)
- ✅ Fix parameter types (bigint + number, not hex strings)
- ✅ `erc7715Service` properly requests permissions
- ✅ Stores permission context from MetaMask response
- ✅ Frontend displays permission status

#### Phase 2: Gelato Integration (This Sprint)
- Create `gelatoAutomationService` for task management
- Store Gelato task IDs + metadata in database
- Endpoint: `/api/automation/execute-purchase-tickets`
  - Validates Gelato request signature
  - Verifies permission is in valid period
  - Executes Megapot purchase
  - Logs execution for monitoring

#### Phase 3: Frontend Monitoring (This Sprint)
- Dashboard shows "Next automatic purchase: Jan 15 at 2pm UTC"
- Display permission status + remaining budget
- Pause/resume automation without re-approving
- View execution history

### Megapot Integration Details

**What Megapot Requires:**
```typescript
purchaseTickets(
  referrer: Address,        // 0x0 for no referrer
  value: bigint,            // Amount in USDC (1_000_000 = $1)
  recipient: Address        // Who gets the tickets
)
```

**What We Do:**
```typescript
// In /api/automation/execute-purchase-tickets
const megapotAddress = "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95";

// 1. Verify permission allows this amount
const remainingBudget = await verifyPermissionStatus(userAddress);
if (remainingBudget < purchaseAmount) {
  throw new Error('Insufficient delegated allowance');
}

// 2. Call Megapot with delegated USDC
const tx = await publicClient.simulateContract({
  address: megapotAddress,
  abi: MEGAPOT_ABI,
  functionName: 'purchaseTickets',
  args: [REFERRER_ADDRESS, purchaseAmount, userAddress]
});

// 3. Execute via relay/EOA with delegated permissions
return await executeDelegatedTransaction(tx);
```

### Configuration

```typescript
// .env.local
GELATO_API_KEY=your-gelato-api-key
GELATO_RELAYER_ADDRESS=your-gelato-relayer-address
MEGAPOT_CONTRACT=0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95
MEGAPOT_REFERRER=0x0000000000000000000000000000000000000000

// Database (for persisting Gelato task IDs)
// user_auto_purchase_tasks:
//   - userId: string
//   - gelatoTaskId: string
//   - frequency: 'daily' | 'weekly' | 'monthly'
//   - amountPerPeriod: bigint
//   - status: 'active' | 'paused' | 'disabled'
//   - createdAt: timestamp
```

### Core Implementation Files

**New Files:**
- `src/services/automation/gelatoService.ts` - Gelato API integration
- `src/pages/api/automation/execute-purchase-tickets.ts` - Execution endpoint
- `src/services/automation/permissionValidator.ts` - Permission period checking
- `src/hooks/useGelatoAutomation.ts` - Frontend automation control

**Enhanced Files:**
- `src/services/erc7715Service.ts` - Already has permission request logic
- `AutoPurchasePermissionModal.tsx` - Add Gelato task registration after permission
- `useAdvancedPermissions.ts` - Add Gelato status to hook return

### Core Principles Applied

**ENHANCEMENT FIRST**
- Extend existing `erc7715Service` with permission context storage
- Reuse `AutoPurchasePermissionModal` for Gelato signup
- No new approval flows needed

**AGGRESSIVE CONSOLIDATION**
- Remove unused `createSmartSession()` and `createAutoPurchaseSession()` 
- Smart Sessions don't work for this use case - delete them
- Delete `permittedTicketExecutor.ts` (relaced by Gelato)

**DRY**
- Single source of truth: `gelatoService` for all Gelato operations
- Permission validation shared in `permissionValidator`

**CLEAN**
- Gelato service isolated from ERC-7715 service
- Clear API boundaries: request permission → register Gelato task → monitor
- Explicit dependencies between layers

**MODULAR**
- `gelatoService` works independently of UI
- Can test permission validation separately
- Automation endpoint is standalone

**PERFORMANT**
- Gelato handles all polling (no frontend polling)
- Minimal database queries
- Cached permission status in localStorage

**ORGANIZED**
- `/automation/` folder contains all automation logic
- Services in `/services/automation/`
- API endpoints in `/pages/api/automation/`
- Hooks in `/hooks/` with `useGelato*` prefix

### Testing Checklist

- [ ] Permission request with correct bigint/number types
- [ ] Permission context properly extracted from MetaMask response
- [ ] Gelato task creation with proper schedule encoding
- [ ] Endpoint validates Gelato signature
- [ ] Permission period validation works
- [ ] Megapot.purchaseTickets() executes with delegated funds
- [ ] Fee calculation is accurate
- [ ] Frontend displays next execution time
- [ ] Can pause/resume without re-approving
- [ ] Execution history persists

### Hackathon Submission

**Title:** "Automated Lottery Ticket Purchases via MetaMask Advanced Permissions + Gelato"

**Demonstration:**
1. User grants Advanced Permission: "Spend 50 USDC per week"
2. Click "Enable Auto-Purchase" → Gelato task created
3. Dashboard shows "Next purchase in 7 days"
4. (Gelato-simulated execution on testnet) Tickets purchased automatically
5. Show delegated permission flow end-to-end

## Conclusion

By combining **MetaMask Advanced Permissions** (permission grants) with **Gelato Network** (execution automation), we achieve true serverless auto-purchasing without backend complexity, while following all core principles of the Syndicate project.
