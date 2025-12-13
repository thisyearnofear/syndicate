// Test script to verify Stacks + Leather wallet integration
import { AppConfig, UserSession } from '@stacks/auth';
import { showConnect } from '@stacks/connect';

console.log('=== Stacks Wallet Integration Test ===');

// Test 1: Check library imports
try {
  console.log('✓ @stacks/connect imported successfully');
  console.log('✓ @stacks/auth imported successfully');
} catch (error) {
  console.error('✗ Failed to import Stacks libraries:', error);
  process.exit(1);
}

// Test 2: Create basic configuration
try {
  const appConfig = new AppConfig(['store_write', 'publish_data']);
  const userSession = new UserSession({ appConfig });
  console.log('✓ Stacks configuration created successfully');
} catch (error) {
  console.error('✗ Failed to create Stacks configuration:', error);
}

// Test 3: Check for wallet providers in browser environment
if (typeof window !== 'undefined') {
  console.log('✓ Running in browser environment');
  
  // Check for wallet providers
  const providers = {
    stacks: !!window.StacksProvider,
    leather: !!window.LeatherProvider,
    hiro: !!window.HiroWalletProvider
  };
  
  console.log('Detected wallet providers:', providers);
  
  if (providers.leather) {
    console.log('✓ Leather wallet detected');
  } else {
    console.log('⚠ Leather wallet not detected');
  }
} else {
  console.log('ℹ Not running in browser environment - skipping provider detection');
}

console.log('=== Test Complete ===');
console.log('Next steps:');
console.log('1. Open debug-wallet.html in your browser');
console.log('2. Follow the troubleshooting checklist if issues persist');