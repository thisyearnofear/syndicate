// Debug Leather Wallet Provider Detection
console.log('=== Leather Wallet Debug Info ===');

// Check if Leather wallet provider is available
console.log('Window object keys:', Object.keys(window));
console.log('Stacks provider exists:', !!window.StacksProvider);
console.log('Hiro wallet exists:', !!window.HiroWalletProvider);
console.log('Leather wallet exists:', !!window.LeatherProvider);

// Check for any Stacks-related properties on window object
const stacksProps = Object.keys(window).filter(key =>
  key.toLowerCase().includes('stack') ||
  key.toLowerCase().includes('leather') ||
  key.toLowerCase().includes('hiro')
);
console.log('Stacks/Leather/Hiro related properties:', stacksProps);

// Try to manually request addresses if provider exists
if (window.StacksProvider) {
  console.log('StacksProvider found, attempting to get addresses...');
  try {
    window.StacksProvider.request('getAddresses')
      .then(result => console.log('Addresses result:', result))
      .catch(error => console.error('Error getting addresses:', error));
  } catch (err) {
    console.error('Exception when calling getAddresses:', err);
  }
}

// Check for Ethereum provider conflicts
console.log('Ethereum provider exists:', !!window.ethereum);
if (window.ethereum) {
  console.log('Ethereum provider type:', typeof window.ethereum);
  console.log('Ethereum provider keys:', Object.keys(window.ethereum));
}

// Check for dangerous setImmediate polyfill
console.log('setImmediate checks:');
console.log('window.setImmediate exists:', !!window.setImmediate);
if (window.setImmediate) {
  console.log('window.setImmediate source:', window.setImmediate.toString());
}

// Listen for messages to detect "setImmediate" spam
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (typeof event.data === 'string' && event.data.includes('setImmedia')) {
      console.warn('SPAM DETECTED: Received "setImmediate" message:', event.data);
      console.log('Origin:', event.origin);
    }
  });
}

console.log('=== End Debug Info ===');