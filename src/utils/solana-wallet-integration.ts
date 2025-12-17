import { Connection, PublicKey } from '@solana/web3.js';

// Secure implementation for Solana/Phantom wallet integration
class SolanaWalletIntegration {
  private ALCHEMY_API_KEY: string;
  private USDC_MINT_ADDRESS: string;

  constructor() {
    this.ALCHEMY_API_KEY = process.env.SOLANA_ALCHEMY_API_KEY || 'your-api-key-here';
    this.USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  }

  isPhantomInstalled(): boolean {
    return typeof window !== 'undefined' && !!(window as unknown as { phantom?: { solana?: { isPhantom?: boolean } } }).phantom?.solana?.isPhantom;
  }

  async connectPhantom(): Promise<string> {
    if (!this.isPhantomInstalled()) {
      throw new Error('Phantom wallet is not installed');
    }

    const provider = (window as unknown as { phantom?: { solana?: { connect: () => Promise<{ publicKey: { toString: () => string } }> } } }).phantom?.solana;
    if (!provider) throw new Error('Phantom provider not available');
    const response = await provider.connect();
    return response.publicKey.toString();
  }

  createSecureConnection(): Connection {
    const endpoint = this.ALCHEMY_API_KEY ?
      `https://solana-mainnet.g.alchemy.com/v2/${this.ALCHEMY_API_KEY}` :
      'https://api.mainnet-beta.solana.com';
    return new Connection(endpoint, 'confirmed');
  }

  async getUsdcBalance(walletPublicKey: string): Promise<number> {
    const connection = this.createSecureConnection();
    const publicKey = new PublicKey(walletPublicKey);
    const usdcMint = new PublicKey(this.USDC_MINT_ADDRESS);

    const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
      mint: usdcMint,
    });

    if (tokenAccounts.value.length > 0) {
      const balance = await connection.getTokenAccountBalance(
        tokenAccounts.value[0].pubkey
      );
      return balance.value.uiAmount || 0;
    }
    return 0;
  }

  async connectAndGetUsdcBalance(): Promise<{ walletPublicKey: string; usdcBalance: number }> {
    const walletPublicKey = await this.connectPhantom();
    const usdcBalance = await this.getUsdcBalance(walletPublicKey);

    return {
      walletPublicKey,
      usdcBalance,
    };
  }
}

export default SolanaWalletIntegration;
