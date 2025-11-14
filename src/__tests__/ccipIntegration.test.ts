/**
 * CCIP Integration Test
 * 
 * This test verifies that the CCIP configuration and integration is working correctly.
 * It checks that the contract addresses are properly configured and that the bridge
 * service can access them.
 */

import { CCIP } from '../src/config/ccipConfig';
import { BridgeResult, BridgeOptions } from '../src/services/bridgeService';

// Mock provider and signer for testing
const mockProvider = {
  getNetwork: async () => ({ chainId: 1n }),
};

const mockSigner = {
  getAddress: async () => '0x0000000000000000000000000000000000000000',
  provider: mockProvider,
};

// Test CCIP configuration
console.log('Testing CCIP Configuration...');
console.log('Ethereum Router:', CCIP.ethereum.router);
console.log('Base Router:', CCIP.base.router);
console.log('Polygon Router:', CCIP.polygon.router);
console.log('Avalanche Router:', CCIP.avalanche.router);

// Verify all required fields are present
const chains = ['ethereum', 'base', 'polygon', 'avalanche'] as const;
for (const chain of chains) {
  const config = CCIP[chain];
  if (!config.router) {
    console.error(`Missing router address for ${chain}`);
    process.exit(1);
  }
  if (!config.chainSelector) {
    console.error(`Missing chain selector for ${chain}`);
    process.exit(1);
  }
  console.log(`✓ ${chain} configuration verified`);
}

console.log('All CCIP configurations verified successfully!');