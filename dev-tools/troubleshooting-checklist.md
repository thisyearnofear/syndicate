# Leather Wallet + Stacks Connection Troubleshooting Checklist

## Immediate Steps to Try

### 1. Basic Wallet Verification
- [ ] Open Leather wallet extension
- [ ] Verify you have a Stacks account created
- [ ] Check that the account has a valid STX address
- [ ] Confirm the wallet is unlocked

### 2. Browser Environment Check
- [ ] Ensure you're using a supported browser (Chrome, Firefox, Brave)
- [ ] Check that Leather wallet extension is enabled
- [ ] Verify the site has permission to access the wallet
- [ ] Try refreshing the page

### 3. Extension Conflicts
- [ ] Disable all other crypto wallet extensions
- [ ] Restart your browser
- [ ] Try connecting again with only Leather enabled

### 4. Network Configuration
- [ ] In Leather wallet, go to Settings > Network
- [ ] Verify you're on the correct network (Mainnet/Testnet)
- [ ] Ensure network matches your application's expected network

## Advanced Debugging

### 1. Console Debugging
Open browser developer tools (F12) and run these commands in the console:

```javascript
// Check for wallet providers
console.log('StacksProvider:', window.StacksProvider);
console.log('LeatherProvider:', window.LeatherProvider);

// Try manual address request
if (window.StacksProvider) {
  window.StacksProvider.request('getAddresses')
    .then(console.log)
    .catch(console.error);
}
```

### 2. Clear Cache and Data
- [ ] Clear browser cache and cookies for the site
- [ ] Restart browser completely
- [ ] Reinstall Leather wallet extension if needed

### 3. Version Compatibility
- [ ] Check @stacks/connect library version
- [ ] Update to latest version: `npm update @stacks/connect`
- [ ] Verify compatibility with Leather wallet version

## Common Error Causes

1. **No Stacks Account**: Leather wallet requires an explicit Stacks account
2. **Network Mismatch**: Application and wallet on different networks
3. **Extension Conflicts**: Multiple wallets interfering with each other
4. **Permission Issues**: Site not authorized to access wallet
5. **Outdated Libraries**: Using incompatible versions of Stacks libraries

## If Issues Persist

1. Try the debug-wallet.html file included in this project
2. Check browser console for detailed error messages
3. Contact Leather wallet support with specific error details
4. Consider using Hiro Wallet as an alternative temporarily