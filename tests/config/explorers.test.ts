import { explorerTxForChain } from '@/config/explorers';
import { xLayerExplorerTx } from '@/config/xlayer';

const HASH = '0x' + 'ab'.repeat(32);

describe('explorerTxForChain', () => {
  it('routes xlayer to the X Layer mainnet explorer', () => {
    expect(explorerTxForChain(HASH, 'xlayer')).toBe(
      `https://www.oklink.com/x-layer/tx/${HASH}`,
    );
  });

  it('routes xlayer_testnet to the existing xLayer explorer helper', () => {
    expect(explorerTxForChain(HASH, 'xlayer_testnet')).toBe(xLayerExplorerTx(HASH));
    expect(explorerTxForChain(HASH, 'xlayer_testnet')).toContain('x-layer-test/tx/');
  });

  it('routes base and base_sepolia to basescan', () => {
    expect(explorerTxForChain(HASH, 'base')).toBe(`https://basescan.org/tx/${HASH}`);
    expect(explorerTxForChain(HASH, 'base_sepolia')).toBe(
      `https://sepolia.basescan.org/tx/${HASH}`,
    );
  });

  it('uses the caller fallback for unknown or missing chains', () => {
    const fallback = (h: string) => `https://example.test/tx/${h}`;
    expect(explorerTxForChain(HASH, 'stacks', fallback)).toBe(`https://example.test/tx/${HASH}`);
    expect(explorerTxForChain(HASH, null, fallback)).toBe(`https://example.test/tx/${HASH}`);
    expect(explorerTxForChain(HASH, undefined, fallback)).toBe(
      `https://example.test/tx/${HASH}`,
    );
  });

  it('defaults to basescan when no fallback is given', () => {
    expect(explorerTxForChain(HASH, 'mystery')).toBe(`https://basescan.org/tx/${HASH}`);
  });
});
