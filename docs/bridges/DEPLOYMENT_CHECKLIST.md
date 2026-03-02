# Deployment Checklist: MegapotAutoPurchaseProxy

## Prerequisites

- [ ] Foundry installed (`forge --version`)
- [ ] Deployer wallet with Base ETH for gas
- [ ] Base RPC URL configured
- [ ] Megapot contract address verified
- [ ] USDC contract address verified (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

## Deployment Steps

### 1. Set Environment Variables

```bash
# .env file
PRIVATE_KEY=0x...  # Deployer private key
MEGAPOT_ADDRESS=0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### 2. Compile Contract

```bash
forge build
```

Expected output:
```
[⠊] Compiling...
[⠒] Compiling 1 files with 0.8.20
[⠢] Solc 0.8.20 finished in X.XXs
Compiler run successful!
```

### 3. Test Deployment (Dry Run)

```bash
forge script script/DeployAutoPurchaseProxy.s.sol:DeployAutoPurchaseProxy \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --verify
```

### 4. Deploy to Base Mainnet

```bash
forge script script/DeployAutoPurchaseProxy.s.sol:DeployAutoPurchaseProxy \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

### 5. Verify Deployment

```bash
# Check contract on Basescan
# Verify constructor args match
cast call <PROXY_ADDRESS> "megapot()" --rpc-url $BASE_RPC_URL
cast call <PROXY_ADDRESS> "usdc()" --rpc-url $BASE_RPC_URL
```

Expected:
- `megapot()` returns Megapot address
- `usdc()` returns USDC address

### 6. Test Proxy Functionality

```bash
# Test purchaseTicketsFor (requires USDC approval first)
cast send <PROXY_ADDRESS> \
  "purchaseTicketsFor(address,address,uint256)" \
  <RECIPIENT> <REFERRER> 1000000 \
  --rpc-url $BASE_RPC_URL \
  --private-key $TEST_KEY
```

### 7. Update Environment Variables

```bash
# Production .env
NEXT_PUBLIC_AUTO_PURCHASE_PROXY=<DEPLOYED_PROXY_ADDRESS>
```

### 8. Deploy Application

```bash
# Vercel/production deployment
vercel --prod
# or
git push origin main  # if auto-deploy configured
```

### 9. Monitor First Transactions

- [ ] Check Stacks bridge transaction goes through proxy
- [ ] Check deBridge transaction routes to proxy
- [ ] Check NEAR Chain Signatures uses proxy
- [ ] Verify tickets credited to correct recipients
- [ ] Monitor for any reverts or errors

### 10. Rollback Plan (if needed)

If issues arise:
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or set proxy to zero address (disables proxy requirement)
# Note: This will cause transactions to fail with current code
# Would need to redeploy previous version
```

## Post-Deployment

### Week 1: Monitoring
- [ ] Check all cross-chain purchases use proxy
- [ ] Monitor gas costs
- [ ] Track success/failure rates
- [ ] Review error logs

### Week 2: Optimization
- [ ] Analyze gas usage patterns
- [ ] Consider batch purchase support
- [ ] Evaluate emergency pause mechanism

### Month 1: Operator Sunset
- [ ] Confirm zero USDC held in operator wallet
- [ ] Document operator wallet can be deprecated
- [ ] Plan Wormhole integration to remove operator entirely

## Troubleshooting

### Contract deployment fails
- Check deployer has enough ETH for gas
- Verify RPC URL is correct
- Ensure Megapot and USDC addresses are valid

### Transactions revert
- Check USDC approval to proxy
- Verify Megapot contract is not paused
- Ensure recipient address is valid

### Proxy not being used
- Verify `NEXT_PUBLIC_AUTO_PURCHASE_PROXY` is set
- Check application restarted after env var change
- Review service logs for proxy address

## Contract Addresses

### Base Mainnet
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Megapot: `0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95`
- AutoPurchaseProxy: `<TO_BE_DEPLOYED>`

### Base Sepolia (Testnet)
- USDC: `<TESTNET_ADDRESS>`
- Megapot: `<TESTNET_ADDRESS>`
- AutoPurchaseProxy: `<TO_BE_DEPLOYED>`
