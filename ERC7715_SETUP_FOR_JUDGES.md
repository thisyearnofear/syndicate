# ERC-7715 Advanced Permissions Setup Guide for Judges

## Overview

Syndicate implements **MetaMask Advanced Permissions (ERC-7715)** to enable automated recurring lottery ticket purchases without requiring users to approve every transaction.

## Feature: Recurring Auto-Purchase with Advanced Permissions

Instead of approving each ticket purchase individually, users can:

1. **Grant one-time permission** via MetaMask dialog
2. **Specify spending limits** (e.g., "spend up to 50 USDC per week")
3. **Execute multiple purchases automatically** within that limit
4. **No further approvals needed** for transactions within the permission scope

## How to Test ERC-7715 on Syndicate

### Prerequisites

1. **MetaMask Flask** (required for ERC-7715)
   - Download: https://flask.metamask.io
   - ⚠️ Use a separate browser profile to avoid conflicts with regular MetaMask

2. **Base Sepolia Testnet**
   - Chain ID: `84532`
   - RPC: Add to MetaMask or use `https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY`

3. **Test USDC on Base Sepolia**
   - Contract: `0x036CbD53842c5426634E7929541eC2318f3dCd01` (Megapot test token)
   - Faucet: https://faucet.circle.com/ or ask Megapot support

4. **Megapot Testnet Deployment**
   - Megapot is deployed on Base Sepolia
   - Lottery address available in chain config

### Testing Steps

#### Step 1: Switch to Base Sepolia

1. Open MetaMask Flask
2. Select network dropdown → Add Network (or use chainlist)
3. Enter:
   - Network Name: `Base Sepolia`
   - RPC URL: `https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY`
   - Chain ID: `84532`
   - Currency: `ETH`

#### Step 2: Get Test Tokens

1. Request test USDC from faucet
2. Get test ETH for gas (faucet: https://www.sepoliafaucet.io/)

#### Step 3: Test Auto-Purchase Flow

1. **Go to Purchase Modal** on Syndicate app
2. **Select "Auto-Purchase" option** (if available)
3. **Choose frequency**: Weekly (50 USDC) or Monthly (200 USDC)
4. **Approve permission request**:
   - MetaMask Flask will show human-readable permission dialog
   - Displays spending limit and period
   - User can modify limits if `isAdjustmentAllowed: true`
5. **Watch the flow**:
   - "Requesting advanced permissions" step shows the ERC-7715 dialog
   - Permission is granted to session account
   - Future purchases execute automatically within limits

#### Step 4: Verify Automatic Execution

- Fund your account with test USDC
- Return after permission is granted
- New ticket purchases execute **without approval dialogs**
- MetaMask extension shows delegated executions

### What Judges Will See

1. **Traditional Flow** (Regular purchase):
   - User approves USDC spend
   - User approves Megapot contract execution
   - Purchase completes

2. **ERC-7715 Flow** (Auto-purchase):
   - **Step 1**: MetaMask Flask shows rich permission UI
     - "Grant permission to spend up to X USDC per period"
     - User sees adjustable limits
   - **Step 2**: Permission granted to Syndicate's session account
   - **Step 3**: Future purchases execute automatically
     - No more approval dialogs
     - Visible in MetaMask activity log as delegated executions

### Architecture (For Judges' Reference)

```
User (on Base Sepolia with MetaMask Flask)
    ↓
ERC-7715 Permission Request (via Smart Accounts Kit)
    ↓
MetaMask Flask Dialog (human-readable)
    ↓
Permission Granted to Session Account
    ↓
Delegated Execution Framework (ERC-7710)
    ↓
Automatic Purchases Within Permission Scope
```

### Key Technologies

- **ERC-7715**: Permission request standard
- **ERC-7710**: Delegation/execution standard  
- **MetaMask Smart Accounts Kit v0.3.0**: Implementation library
- **Viem**: Blockchain interactions
- **Base Sepolia**: Testnet for hackathon demonstration

### Supported Networks

- ✅ **Base Sepolia** (Testnet) - ERC-7715 enabled for hackathon
- ✅ **Ethereum Sepolia** (Testnet)
- ✅ **Base** (Mainnet) - Coming soon after testing
- ✅ Other EVM chains on MetaMask Smart Accounts Kit compatibility list

### Troubleshooting

**"MetaMask is not installed"**
- Use MetaMask Flask instead: https://flask.metamask.io

**"ERC-7715 not supported"**
- Ensure you're on Base Sepolia (Chain ID 84532)
- Ensure MetaMask Flask version 13.9.0+

**"Permission snaps not installed"**
- MetaMask Flask will auto-prompt to install on first permission request
- Approve the snap installation

**"No permissions granted"**
- User clicked "Reject" on MetaMask dialog
- Try again or check spending limits are reasonable

### For More Information

- MetaMask Smart Accounts Kit: https://docs.metamask.io/smart-accounts-kit/
- ERC-7715 Standard: https://eips.ethereum.org/EIPS/eip-7715
- Base Sepolia Testnet: https://base.org

---

**Questions?** Check the code in `src/services/erc7715Service.ts` for implementation details.
