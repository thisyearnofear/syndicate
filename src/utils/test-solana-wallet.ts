// Test file for Solana wallet integration
import SolanaWalletIntegration from './solana-wallet-integration';

async function testUsdcBalance() {
  try {
    const walletIntegration = new SolanaWalletIntegration();
    
    // This will only work in a browser environment with Phantom installed
    if (typeof window !== 'undefined' && walletIntegration.isPhantomInstalled()) {
      console.log('Phantom wallet detected');
      
      // Connect and get USDC balance
      const result = await walletIntegration.connectAndGetUsdcBalance();
      console.log('Wallet Public Key:', result.walletPublicKey);
      console.log('USDC Balance:', result.usdcBalance);
    } else {
      console.log('Phantom wallet not detected. Please install Phantom wallet.');
      
      // For testing purposes, you can manually set a public key
      // const testPublicKey = 'YOUR_TEST_WALLET_PUBLIC_KEY_HERE';
      // const balance = await walletIntegration.getUsdcBalance(testPublicKey);
      // console.log('USDC Balance:', balance);
    }
  } catch (error) {
    console.error('Error testing USDC balance:', error);
  }
}

// Run the test
testUsdcBalance();