/**
 * Mock for wagmi/chains
 * 
 * Jest can't parse wagmi's ESM exports, so we provide a simple mock.
 */

const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://base-sepolia-rpc.publicnode.com'] },
  },
  testnet: true,
};

const base = {
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
};

module.exports = { baseSepolia, base };
