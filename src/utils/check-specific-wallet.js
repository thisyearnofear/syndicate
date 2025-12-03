// STUB: Using stubs while Solana deps are disabled for hackathon
// TO RE-ENABLE: Replace with '@solana/web3.js'
import { Connection, PublicKey } from './stubs/solana.js';

async function testUsdcBalanceForWallet() {
  try {
    // Use Alchemy RPC endpoint
    const ALCHEMY_API_KEY = process.env.SOLANA_ALCHEMY_API_KEY || 'G0vLpBA5CeTNUKONNo2gz';
    const connection = new Connection(
      `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      'confirmed'
    );

    // Wallet address to check
    const walletAddress = '4FzyJeDxqRn2SKwVLdh2gi9MCvrSvgkCvHDZnNyBpd5v';
    const walletPublicKey = new PublicKey(walletAddress);
    
    console.log('Checking USDC balance for wallet:', walletAddress);

    // USDC Mint Address
    const USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const usdcMint = new PublicKey(USDC_MINT_ADDRESS);

    // Get all token accounts for the wallet
    const tokenAccounts = await connection.getTokenAccountsByOwner(walletPublicKey, {
      mint: usdcMint,
    });

    console.log('Found', tokenAccounts.value.length, 'USDC token accounts');

    if (tokenAccounts.value.length > 0) {
      // Get balance of the first USDC account
      const balance = await connection.getTokenAccountBalance(
        tokenAccounts.value[0].pubkey
      );
      console.log('USDC Balance:', balance.value.uiAmount);
      console.log('Raw Balance:', balance.value.amount);
      return balance.value.uiAmount;
    } else {
      console.log('No USDC account found for this wallet');
      return 0;
    }
  } catch (error) {
    console.error('Error fetching USDC balance:', error);
    throw error;
  }
}

// Run the test
testUsdcBalanceForWallet().then(balance => {
  console.log('Final USDC Balance:', balance);
}).catch(error => {
  console.error('Test failed:', error);
});
