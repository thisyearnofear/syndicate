import { sepolia, base, avalanche, mainnet } from "viem/chains";

// Syndicate supports multiple chains for cross-chain lottery participation
export const SUPPORTED_CHAINS = {
  base: {
    ...base,
    name: "Base",
    explorerUrl: "https://basescan.org",
    rpcUrl: "https://mainnet.base.org",
  },
  avalanche: {
    ...avalanche,
    name: "Avalanche",
    explorerUrl: "https://snowtrace.io",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
  },
  ethereum: {
    ...mainnet,
    name: "Ethereum",
    explorerUrl: "https://etherscan.io",
    rpcUrl: "https://eth.llamarpc.com",
  },
  sepolia: {
    ...sepolia,
    name: "Sepolia Testnet",
    explorerUrl: "https://sepolia.etherscan.io",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  },
};

// Default configuration for development
export const config = {
  chain: sepolia,
  ethScanerUrl: "https://sepolia.etherscan.io",
  // Megapot contract addresses (to be updated with actual addresses)
  contracts: {
    megapot: "0x...", // Megapot lottery contract on Base
    syndicate: "0x...", // Syndicate coordination contract
    causeFund: "0x...", // Cause-based distribution contract
  },
  // NEAR configuration for chain signatures
  near: {
    networkId: "mainnet",
    nodeUrl: "https://rpc.mainnet.near.org",
    walletUrl: "https://wallet.mainnet.near.org",
    helperUrl: "https://helper.mainnet.near.org",
  },
};
