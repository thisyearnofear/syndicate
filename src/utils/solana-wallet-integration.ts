// STUB: Using stubs while Solana deps are disabled for hackathon
// TO RE-ENABLE: Replace with '@solana/web3.js'
import { Connection, PublicKey } from '@/stubs/solana';

// Secure implementation for Solana/Phantom wallet integration
class SolanaWalletIntegration {
  private ALCHEMY_API_KEY: string;
  private USDC_MINT_ADDRESS: string;

  constructor() {
    // Store API key securely - in production, use environment variables
    this.ALCHEMY_API_KEY = process.env.SOLANA_ALCHEMY_API_KEY || 'your-api-key-here';
    
    // USDC Mint Address (verified)
    this.USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  }

  // Check if Phantom wallet is available
  isPhantomInstalled(): boolean {
    return typeof window !== 'undefined' && !!(window as unknown as { phantom?: { solana?: { isPhantom?: boolean } } }).phantom?.solana?.isPhantom;
  }

  // Connect to Phantom wallet
  async connectPhantom(): Promise<string> {
    if (!this.isPhantomInstalled()) {
      throw new Error('Phantom wallet is not installed');
    }

    try {
      const provider = (window as unknown as { phantom?: { solana?: { connect: () => Promise<{ publicKey: { toString: () => string } }> } } }).phantom?.solana;
      if (!provider) throw new Error('Phantom provider not available');
      const response = await provider.connect();
      return response.publicKey.toString();
    } catch (error) {
      console.error('Failed to connect to Phantom:', error);
      throw error;
    }
  }

  // Create secure connection to Solana RPC
  createSecureConnection(): Connection {
    // Use Alchemy RPC endpoint instead of the public mainnet-beta endpoint
    // which was causing the 403 Forbidden errors
    const connection = new Connection(
      `https://solana-mainnet.g.alchemy.com/v2/${this.ALCHEMY_API_KEY}`,
      'confirmed'
    );
    return connection;
  }

  // Get USDC token balance
  async getUsdcBalance(walletPublicKey: string): Promise<number> {
    try {
      const connection = this.createSecureConnection();
      const publicKey = new PublicKey(walletPublicKey);
      const usdcMint = new PublicKey(this.USDC_MINT_ADDRESS);

      // Get all token accounts for the wallet
      const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
        mint: usdcMint,
      });

      if (tokenAccounts.value.length > 0) {
        // Get balance of the first USDC account
        const balance = await connection.getTokenAccountBalance(
          tokenAccounts.value[0].pubkey
        );
        return balance.value.uiAmount || 0;
      } else {
        // No USDC account found
        return 0;
      }
    } catch (error) {
      console.error('Error fetching USDC balance:', error);
      throw error;
    }
  }

  // Main function to connect wallet and get USDC balance
  async connectAndGetUsdcBalance(): Promise<{ walletPublicKey: string; usdcBalance: number }> {
    try {
      // Connect to Phantom wallet
      const walletPublicKey = await this.connectPhantom();
      console.log('Connected to wallet:', walletPublicKey);

      // Get USDC balance
      const usdcBalance = await this.getUsdcBalance(walletPublicKey);
      console.log('USDC Balance:', usdcBalance);

      return {
        walletPublicKey,
        usdcBalance,
      };
    } catch (error) {
      console.error('Error in connectAndGetUsdcBalance:', error);
      throw error;
    }
  }
}

export default SolanaWalletIntegration;
