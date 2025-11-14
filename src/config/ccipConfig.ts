/**
 * CCIP CONFIGURATION (Chainlink Cross-Chain Interoperability Protocol)
 *
 * Centralized registry for CCIP router addresses and chain selectors.
 * Addresses are verified and audited contracts from Chainlink.
 *
 * Reference: https://docs.chain.link/ccip/supported-networks
 */

export const CCIP = {
  ethereum: {
    chainSelector: 5009297550715157269n, // Ethereum mainnet chain selector
    router: '0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D', // Verified CCIP router
    usdc: '0xA0b86991c431e50B4f4b4e8A3c02c5d0C2f10d5D',
  },
  base: {
    chainSelector: 1597130588950509655n, // Base chain selector
    router: '0x881e3A65B4d4a04dD529061dd0071cf975F58bCD', // Verified CCIP router
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  polygon: {
    chainSelector: 4051577828743386545n, // Polygon mainnet chain selector
    router: '0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe', // Verified CCIP router
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
  avalanche: {
    chainSelector: 6433500567565415381n, // Avalanche mainnet chain selector
    router: '0xF4c7E640EdA248ef95972845a62bdC74237805dB', // Verified CCIP router
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9C48a6E',
  },
} as const;

export type CcipChainKey = keyof typeof CCIP;
export type CcipConfig = typeof CCIP[CcipChainKey];

export default CCIP;