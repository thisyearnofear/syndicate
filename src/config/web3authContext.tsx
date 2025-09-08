import { type Web3AuthContextConfig } from "@web3auth/modal/react";
import { WEB3AUTH_NETWORK, type Web3AuthOptions } from "@web3auth/modal";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import { SolanaPrivateKeyProvider } from "@web3auth/solana-provider";

// CLEAN: Solana chain configuration for Web3Auth
export const solanaChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.SOLANA,
  chainId: "0x3", // 0x3 for Devnet, 0x1 for Mainnet
  rpcTarget:
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
  displayName: "Solana Devnet",
  blockExplorerUrl: "https://explorer.solana.com/?cluster=devnet",
  ticker: "SOL",
  tickerName: "Solana",
  logo: "https://images.toruswallet.io/solana.svg",
};

// CLEAN: Web3Auth configuration with Solana support
const web3AuthOptions: Web3AuthOptions = {
  clientId:
    process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID ||
    "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
  // Align the network with the project configuration (mainnet)
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
  // Removed unsupported chainConfig property – Solana chain is provided via solanaProvider
  uiConfig: {
    appName: "Syndicate",
    // Use the current origin when running locally to avoid metadata URL mismatch
    appUrl:
      typeof window !== "undefined"
        ? window.location.origin
        : "https://syndicate.app",
    theme: {
      primary: "#7c3aed",
    },
    mode: "dark",
    logoLight: "https://syndicate.app/logo-light.png",
    logoDark: "https://syndicate.app/logo-dark.png",
    defaultLanguage: "en",
    loginGridCol: 3,
    primaryButton: "externalLogin",
  },
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
