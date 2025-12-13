# Leather Wallet + Stacks Connection Debugging Tools

This directory contains several tools to help debug and fix the "No Stacks address found" error with Leather wallet.

## Files Created:

1. **debug-wallet.js** - Simple debugging script to check wallet provider detection
2. **comprehensive-debug.js** - Detailed debugging script with provider checks and connection attempts
3. **wallet-connection.js** - Proper implementation of Stacks Connect with error handling
4. **debug-wallet.html** - Interactive HTML page for testing wallet connections
5. **troubleshooting-checklist.md** - Step-by-step troubleshooting guide
6. **test-stacks-setup.js** - Verification script for Stacks library setup

## How to Use These Tools:

### 1. Quick Console Debugging
Open your browser's developer tools (F12) on your application page and run:

```javascript
// Check what wallet providers are available
console.log('StacksProvider:', window.StacksProvider);
console.log('LeatherProvider:', window.LeatherProvider);

// Try to manually request addresses
if (window.StacksProvider) {
  window.StacksProvider.request('getAddresses')
    .then(result => console.log('Addresses:', result))
    .catch(error => console.error('Error:', error));
}
```

### 2. Using the Debug HTML Page
Open `debug-wallet.html` in your browser to use the interactive debugger:
- Click "Check Wallet Providers" to see what wallets are detected
- Click "Connect to Leather Wallet" to test the connection
- View detailed logs in the console area

### 3. Following the Troubleshooting Checklist
Refer to `troubleshooting-checklist.md` for a step-by-step approach to resolving the issue.

## Common Solutions:

1. **Verify Stacks Account**: Make sure you have created a Stacks account in Leather wallet
2. **Check Network Settings**: Ensure Leather wallet is on the same network as your application
3. **Disable Extension Conflicts**: Temporarily disable other wallet extensions
4. **Update Libraries**: Ensure you're using compatible versions of Stacks libraries
5. **Clear Cache**: Clear browser cache and restart browser

## If Problems Persist:

1. Check browser console for detailed error messages
2. Try the manual debugging commands above
3. Contact Leather wallet support with specific error details
4. Consider using Hiro Wallet as a temporary alternative