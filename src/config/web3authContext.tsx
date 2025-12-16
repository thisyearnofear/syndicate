// STUB: Using stubs while Web3Auth deps are disabled for hackathon
// TO RE-ENABLE: Replace with '@web3auth/*' imports
import {
  type Web3AuthContextConfig,
  type Web3AuthOptions,
  WEB3AUTH_NETWORK,
  CHAIN_NAMESPACES,
  SolanaPrivateKeyProvider,
} from '@/stubs/web3auth';

// PHASE 4 MAINNET: Solana mainnet configuration for production
export const solanaChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.SOLANA,
  chainId: "0x1", // 0x1 for Mainnet-Beta
  rpcTarget:
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    "https://api.mainnet-beta.solana.com",
  displayName: "Solana Mainnet",
  blockExplorerUrl: "https://explorer.solana.com?cluster=mainnet-beta",
  ticker: "SOL",
  tickerName: "Solana",
  logo: "https://images.toruswallet.io/solana.svg",
};

// PHASE 4 MAINNET: Web3Auth configuration with Solana mainnet support
const web3AuthOptions: Web3AuthOptions = {
  clientId:
    process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID ||
    "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
  // PHASE 4: Use Sapphire Mainnet for production
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
  // Removed unsupported chainConfig property – Solana chain is provided via solanaProvider
};

// ENHANCEMENT: Create Solana provider for Web3Auth
export const solanaProvider = new SolanaPrivateKeyProvider({
  config: {
    chainConfig: solanaChainConfig,
  },
});

const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions,
};

export default web3AuthContextConfig;
