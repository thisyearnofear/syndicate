import {
  XLAYER_MAINNET_CHAIN_ID,
  XLAYER_TESTNET_CHAIN_ID,
  formatXLayerShareOdds,
  isXLayerDeploymentConfigured,
  xLayerTestnet,
} from '@/config/xlayer';

describe('X Layer configuration', () => {
  it('defines the expected testnet and mainnet IDs', () => {
    expect(xLayerTestnet.id).toBe(XLAYER_TESTNET_CHAIN_ID);
    expect(XLAYER_TESTNET_CHAIN_ID).toBe(1952);
    expect(XLAYER_MAINNET_CHAIN_ID).toBe(196);
    expect(xLayerTestnet.testnet).toBe(true);
  });

  it('accepts only complete, valid deployment addresses', () => {
    expect(isXLayerDeploymentConfigured({ hook: '', router: '', poolManager: '' })).toBe(false);
    expect(isXLayerDeploymentConfigured({
      hook: '0x0000000000000000000000000000000000000001',
      router: '0x0000000000000000000000000000000000000002',
      poolManager: 'not-an-address',
    })).toBe(false);
    expect(isXLayerDeploymentConfigured({
      hook: '0x0000000000000000000000000000000000000001',
      router: '0x0000000000000000000000000000000000000002',
      poolManager: '0x0000000000000000000000000000000000000003',
    })).toBe(true);
  });

  it('formats share odds without converting bigint balances to Number', () => {
    expect(formatXLayerShareOdds(1n, 3n)).toBe('33.33%');
    expect(formatXLayerShareOdds(1_000_000_000_000_000_001n, 2_000_000_000_000_000_000n)).toBe('50.00%');
    expect(formatXLayerShareOdds(undefined, 1n)).toBe('—');
  });
});
