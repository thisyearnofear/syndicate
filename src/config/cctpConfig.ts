/**
 * CCTP CONFIGURATION (Circle Cross-Chain Transfer Protocol, V2)
 *
 * Centralized registry for CCTP addresses and domain IDs.
 * Addresses are standardized per Circle docs across supported EVM chains.
 *
 * Reference: https://developers.circle.com/cctp/evm-smart-contracts
 */

export const CCTP = {
  ethereum: {
    domain: 0,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdc: '0xA0b86991c431e50B4f4b4e8A3c02c5d0C2f10d5D',
  },
  base: {
    domain: 6,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    // USDC on Base is managed by unified CONTRACTS config; left undefined here
    usdc: undefined as string | undefined,
  },
} as const;

export type CctpChainKey = keyof typeof CCTP;
export type CctpConfig = typeof CCTP[CctpChainKey];

export default CCTP;