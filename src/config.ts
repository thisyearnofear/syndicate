import { sepolia, base, avalanche, mainnet } from "viem/chains";

// Syndicate supports multiple chains for cross-chain lottery participation
export const SUPPORTED_CHAINS = {
  base: {
    ...base,
    name: "Base",
    explorerUrl: "https://basescan.org",
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://base-mainnet.g.alchemy.com/v2/zXTB8midlluEtdL8Gay5bvz5RI-FfsDH",
    pimlicoRpcUrl: process.env.NEXT_PUBLIC_PIMLICO_BASE_RPC || "https://api.pimlico.io/v2/8453/rpc?apikey=pim_JppWZ3Cupeq1sG3SJ4fLTa",
  },
  avalanche: {
    ...avalanche,
    name: "Avalanche",
    explorerUrl: "https://snowtrace.io",
    rpcUrl: process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || "https://api.pimlico.io/v2/43114/rpc?apikey=pim_JppWZ3Cupeq1sG3SJ4fLTa",
    pimlicoRpcUrl: process.env.NEXT_PUBLIC_PIMLICO_AVALANCHE_RPC || "https://api.pimlico.io/v2/43114/rpc?apikey=pim_JppWZ3Cupeq1sG3SJ4fLTa",
  },
  ethereum: {
    ...mainnet,
    name: "Ethereum",
    explorerUrl: "https://etherscan.io",
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || "https://mainnet.infura.io/v3/119d623be6f144138f75b5af8babdda4",
  },
  sepolia: {
    ...sepolia,
    name: "Sepolia Testnet",
    explorerUrl: "https://sepolia.etherscan.io",
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/119d623be6f144138f75b5af8babdda4",
  },
};

// Default configuration for development
export const config = {
  chain: sepolia,
  ethScanerUrl: "https://sepolia.etherscan.io",
  // Megapot contract addresses
  contracts: {
    megapot: process.env.NEXT_PUBLIC_MEGAPOT_CONTRACT || "0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95", // Megapot lottery contract on Base
    syndicate: process.env.NEXT_PUBLIC_SYNDICATE_CONTRACT || "0x0000000000000000000000000000000000000000", // Syndicate coordination contract
    causeFund: process.env.NEXT_PUBLIC_CAUSE_FUND_CONTRACT || "0x0000000000000000000000000000000000000000", // Cause-based distribution contract
    usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC token on Base
  },
  // NEAR configuration for chain signatures
  near: {
    networkId: process.env.NEXT_PUBLIC_NEAR_NETWORK_ID || "mainnet",
    nodeUrl: process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.mainnet.near.org",
    walletUrl: process.env.NEXT_PUBLIC_NEAR_WALLET_URL || "https://wallet.mainnet.near.org",
    helperUrl: process.env.NEXT_PUBLIC_NEAR_HELPER_URL || "https://helper.mainnet.near.org",
    mpcContract: "v1.signer", // Real NEAR Chain Signatures contract
    chainSignatureContract: "v1.signer", // Same contract handles signing
  },
  // API Keys
  pimlico: {
    apiKey: process.env.NEXT_PUBLIC_PIMLICO_API_KEY || "",
  },
  infura: {
    projectId: process.env.NEXT_PUBLIC_INFURA_PROJECT_ID || "",
  },
  alchemy: {
    apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  },
};
