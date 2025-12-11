# Testing Setup Guide

**Last Updated**: December 11, 2025
**Status**: Basic setup (dependencies needed)

## 🚨 Current Issues

The project has missing dependencies that need to be installed:
- Jest and related testing packages are not installed
- Many production dependencies are missing
- npm install is timing out

## 📋 Immediate Testing Plan

### Step 1: Fix Dependencies

```bash
# Try installing dependencies in smaller chunks
npm install jest jest-environment-jsdom ts-jest @types/jest --save-dev

# If that fails, try:
npm install --legacy-peer-deps

# Or use yarn instead:
yarn install
```

### Step 2: Verify Test Setup

```bash
# Check jest version
npx jest --version

# Run existing tests
npm run test
```

### Step 3: Expand Test Coverage

Create additional test files for:
- Wallet connections (EVM, Solana, NEAR)
- Ticket purchase flows
- Bridge operations
- Error handling scenarios

## 🧪 Test Structure

### Existing Tests
- `src/__tests__/bridgeImprovements.test.ts` - Bridge protocol tests

### Recommended Additional Tests

#### Wallet Connection Tests
```typescript
// src/__tests__/walletConnection.test.ts
describe('Wallet Connection', () => {
  it('should connect MetaMask wallet', async () => {
    // Mock wallet connection
    // Test successful connection
    // Test error scenarios
  });

  it('should connect Phantom wallet', async () => {
    // Test Solana wallet connection
    // Test balance queries
  });

  it('should handle connection errors', async () => {
    // Test rejected connections
    // Test network errors
  });
});
```

#### Ticket Purchase Tests
```typescript
// src/__tests__/ticketPurchase.test.ts
describe('Ticket Purchase', () => {
  it('should purchase ticket via EVM', async () => {
    // Mock bridge and purchase flow
    // Test successful purchase
  });

  it('should handle purchase failures', async () => {
    // Test insufficient funds
    // Test network errors
  });
});
```

## 🔧 Test Configuration

### Jest Configuration

The project has a `jest.config.js` file that should work once dependencies are installed.

### Test Scripts

Available in `package.json`:
- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## 📝 Manual Testing Guide

### Critical Flows to Test Manually

#### 1. Wallet Connection
1. Open the app in browser
2. Click "Connect Wallet"
3. Test MetaMask connection
4. Test Phantom connection (if available)
5. Test NEAR wallet connection
6. Verify wallet address is displayed
7. Verify network switching works

#### 2. Ticket Purchase (EVM → Base)
1. Connect MetaMask wallet
2. Ensure you're on Ethereum network
3. Navigate to ticket purchase page
4. Enter small amount (test with 0.01 USDC equivalent)
5. Confirm transaction in MetaMask
6. Monitor bridge status
7. Verify USDC arrives on Base network
8. Verify ticket is purchased successfully

#### 3. Bridge Operations
1. Navigate to /bridge page
2. Select CCTP protocol
3. Enter test amount
4. Initiate bridge transaction
5. Monitor attestation status
6. Verify funds arrive on destination
7. Test fallback to Wormhole if CCTP fails

#### 4. Error Scenarios
1. Test with insufficient funds
2. Test with wrong network
3. Test transaction rejection
4. Test network errors
5. Verify error messages are clear
6. Verify recovery options are available

## 🐛 Known Issues to Test

### Bridge Issues
- CCTP attestation timeouts (can take 15+ minutes)
- Solana → Base bridge sometimes fails on mint
- Wormhole fallback needed for reliability

### Wallet Issues
- Phantom balance queries sometimes timeout
- WalletConnect occasionally hangs
- Network switching can be slow

### UI Issues
- Bridge status updates can be delayed
- Error messages need improvement
- Loading states need refinement

## 📋 Test Checklist

### Before Testing
- [ ] Install all dependencies
- [ ] Set up test wallets (MetaMask, Phantom)
- [ ] Get test USDC on Ethereum and Solana
- [ ] Review test documentation
- [ ] Set up error monitoring

### During Testing
- [ ] Test all wallet connections
- [ ] Test all bridge protocols
- [ ] Test ticket purchase flows
- [ ] Test error scenarios
- [ ] Test on different browsers
- [ ] Test on mobile devices
- [ ] Document all issues found

### After Testing
- [ ] Create bug reports for issues
- [ ] Prioritize fixes
- [ ] Update documentation
- [ ] Retest fixed issues
- [ ] Prepare for user testing

## 🚀 Next Steps

1. **Fix dependencies**: Get npm install working
2. **Run existing tests**: Verify test setup
3. **Expand test coverage**: Add missing test files
4. **Conduct manual testing**: Test critical flows
5. **Set up CI/CD**: Automate testing process

Once dependencies are resolved, we can proceed with the full testing plan.