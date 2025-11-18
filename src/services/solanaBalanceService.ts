import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export async function getSolanaUSDCBalance(walletAddress: string): Promise<string> {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
    );
    
    const walletPubkey = new PublicKey(walletAddress);
    const usdcMint = new PublicKey(USDC_MINT);
    
    const ata = await getAssociatedTokenAddress(usdcMint, walletPubkey);
    const balance = await connection.getTokenAccountBalance(ata);
    
    return balance.value.uiAmount?.toString() || '0';
  } catch (error) {
    console.error('Failed to get Solana USDC balance:', error);
    return '0';
  }
}