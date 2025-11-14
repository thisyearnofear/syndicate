/**
 * Test file for Solana CCTP integration
 * This test verifies that our Solana bridge service can be imported and used correctly
 */

import { solanaBridgeService } from '../services/solanaBridgeService';

// Mock wallet object for testing
const mockWallet = {
  publicKey: 'testPublicKey',
  sendTransaction: jest.fn().mockResolvedValue('mockSignature')
};

describe('Solana CCTP Integration', () => {
  it('should have solanaBridgeService defined', () => {
    expect(solanaBridgeService).toBeDefined();
  });

  it('should have bridgeUsdcSolanaToBase method', () => {
    expect(solanaBridgeService.bridgeUsdcSolanaToBase).toBeDefined();
    expect(typeof solanaBridgeService.bridgeUsdcSolanaToBase).toBe('function');
  });

  // Note: We can't fully test the implementation without a real Solana network connection
  // and proper wallet integration, but we can verify the structure is correct
});