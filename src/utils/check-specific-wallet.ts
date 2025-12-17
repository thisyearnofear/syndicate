import { Connection, PublicKey } from '@solana/web3.js';

async function testUsdcBalanceForWallet() {
  try {
    const ALCHEMY_API_KEY = process.env.SOLANA_ALCHEMY_API_KEY || 'G0vLpBA5CeTNUKONNo2gz';
    const connection = new Connection(
      `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      'confirmed'
    );

    const walletAddress = '4FzyJeDxqRn2SKwVLdh2gi9MCvrSvgkCvHDZnNyBpd5v';
    const walletPublicKey = new PublicKey(walletAddress);
    
    console.log('Checking USDC balance for wallet:', walletAddress);

    const USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const usdcMint = new PublicKey(USDC_MINT_ADDRESS);

    const tokenAccounts = await connection.getTokenAccountsByOwner(walletPublicKey, {
      mint: usdcMint,
    });

    console.log('Found', tokenAccounts.value.length, 'USDC token accounts');

    if (tokenAccounts.value.length > 0) {
      const balance = await connection.getTokenAccountBalance(
        tokenAccounts.value[0].pubkey
      );
      console.log('USDC Balance:', balance.value.uiAmount);
      console.log('Raw Balance:', balance.value.uiAmount);
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
