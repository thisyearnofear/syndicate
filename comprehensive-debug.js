// Comprehensive Wallet Debugging Script
console.log('=== Comprehensive Wallet Debug ===');

// Function to detect available wallet providers
function detectWalletProviders() {
  const providers = {};
  
  // Check for various wallet providers
  providers.stacksProvider = !!window.StacksProvider;
  providers.hiroWallet = !!window.HiroWalletProvider;
  providers.leatherWallet = !!window.LeatherProvider;
  providers.xverseWallet = !!window.XverseProviders;
  
  // Check for generic web3 providers
  providers.ethereum = !!window.ethereum;
  
  // Look for any Stacks-related properties
  const stacksRelated = Object.keys(window).filter(key => 
    key.toLowerCase().includes('stack') || 
    key.toLowerCase().includes('leather') ||
    key.toLowerCase().includes('hiro')
  );
  providers.stacksRelatedProps = stacksRelated;
  
  return providers;
}

// Log detected providers
const detectedProviders = detectWalletProviders();
console.log('Detected Providers:', detectedProviders);

// Attempt to connect to Leather wallet specifically
async function debugLeatherConnection() {
  try {
    console.log('Attempting Leather wallet connection debug...');
    
    // Method 1: Direct provider access
    if (window.StacksProvider) {
      console.log('✓ StacksProvider found');
      
      // Try getAddresses method
      try {
        const addresses = await window.StacksProvider.request('getAddresses');
        console.log('✓ getAddresses successful:', addresses);
      } catch (error) {
        console.error('✗ getAddresses failed:', error);
        
        // Try alternative method names
        try {
          const stxAddresses = await window.StacksProvider.request('stx_getAddresses');
          console.log('✓ stx_getAddresses successful:', stxAddresses);
        } catch (altError) {
          console.error('✗ stx_getAddresses also failed:', altError);
        }
      }
    } else {
      console.log('✗ StacksProvider NOT found');
    }
    
    // Method 2: Check for Leather-specific provider
    if (window.LeatherProvider) {
      console.log('✓ LeatherProvider found');
      
      try {
        const addresses = await window.LeatherProvider.request('getAddresses');
        console.log('✓ Leather getAddresses successful:', addresses);
      } catch (error) {
        console.error('✗ Leather getAddresses failed:', error);
      }
    } else {
      console.log('✗ LeatherProvider NOT found');
    }
    
  } catch (error) {
    console.error('Exception in debugLeatherConnection:', error);
  }
}

// Run the debug function
debugLeatherConnection()
  .then(() => console.log('Debug complete'))
  .catch(err => console.error('Debug failed:', err));

// Additional network and configuration checks
function checkNetworkConfiguration() {
  console.log('=== Network Configuration Check ===');
  
  // Check if we're in a secure context (required for some wallet features)
  console.log('Secure context:', window.isSecureContext);
  
  // Check document location
  console.log('Document origin:', window.location.origin);
  
  // Check for iframe context (some wallets don't work in iframes)
  try {
    console.log('Window.self === Window.top:', window.self === window.top);
  } catch (e) {
    console.log('In iframe context (CORS restricted)');
  }
}

// Run network configuration check
checkNetworkConfiguration();

console.log('=== End Comprehensive Debug ===');